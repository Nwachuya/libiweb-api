/**
 * Auth middleware.
 *
 * Modes:
 * 1) PocketBase mode (preferred): enabled when PB_URL is set.
 * 2) Static key fallback: API_KEYS comma-separated env variable.
 */

const PB_URL = (process.env.PB_URL || "").trim().replace(/\/+$/, "");
const PB_ADMIN_EMAIL = (process.env.PB_ADMIN_EMAIL || "").trim();
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";

const PB_COLLECTION_USERS = (process.env.PB_COLLECTION_USERS || "users").trim();
const PB_COLLECTION_ACCOUNT = (process.env.PB_COLLECTION_ACCOUNT || "account").trim();
const PB_COLLECTION_API_KEYS = (process.env.PB_COLLECTION_API_KEYS || "api_keys").trim();

const PB_REQUIRE_VERIFIED_USER = toBool(process.env.PB_REQUIRE_VERIFIED_USER, true);
const PB_FAIL_CLOSED = toBool(process.env.PB_FAIL_CLOSED, true);
const PB_ALLOWED_API_KEY_STATUS = toSet(process.env.PB_ALLOWED_API_KEY_STATUS || "active");
const PB_ALLOWED_SUB_STATUSES = toSet(process.env.PB_ALLOWED_SUB_STATUSES || "");

const pbSession = {
  token: "",
  authPath: "",
  lastAuthTs: 0
};

const pbAuthPaths = [
  "/api/admins/auth-with-password",
  "/api/collections/_superusers/auth-with-password"
];

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toSet(value) {
  return new Set(
    String(value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase())
  );
}

function getRelationId(value) {
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value === "string") return value;
  return "";
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function escapeFilterValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function authenticatePocketBase(forceRefresh) {
  if (!forceRefresh && pbSession.token) return pbSession.token;

  if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    throw new Error("PocketBase auth is not fully configured (PB_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD).");
  }

  let lastError = null;

  for (const authPath of pbAuthPaths) {
    try {
      const response = await fetch(`${PB_URL}${authPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: PB_ADMIN_EMAIL,
          email: PB_ADMIN_EMAIL,
          password: PB_ADMIN_PASSWORD
        })
      });

      if (!response.ok) {
        lastError = new Error(`PocketBase auth failed on ${authPath} with ${response.status}.`);
        continue;
      }

      const data = await response.json();
      if (!data || !data.token) {
        lastError = new Error(`PocketBase auth succeeded on ${authPath} but no token was returned.`);
        continue;
      }

      pbSession.token = data.token;
      pbSession.authPath = authPath;
      pbSession.lastAuthTs = Date.now();
      return pbSession.token;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("PocketBase authentication failed.");
}

async function pocketBaseRequest(path, options = {}, retry = true) {
  const token = await authenticatePocketBase(false);
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const response = await fetch(`${PB_URL}${path}`, { ...options, headers });

  if (response.status === 401 && retry) {
    await authenticatePocketBase(true);
    return pocketBaseRequest(path, options, false);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PocketBase request failed (${response.status}) on ${path}: ${text}`);
  }

  return response.json();
}

async function validateApiKeyWithPocketBase(apiKey) {
  const filter = `key = "${escapeFilterValue(apiKey)}"`;
  const search = new URLSearchParams({
    page: "1",
    perPage: "1",
    filter
  });

  const apiKeyList = await pocketBaseRequest(
    `/api/collections/${encodeURIComponent(PB_COLLECTION_API_KEYS)}/records?${search.toString()}`
  );

  const keyRecord = apiKeyList.items && apiKeyList.items[0];
  if (!keyRecord) {
    return { allowed: false, code: 403, error: "Invalid API key." };
  }

  const keyStatus = String(keyRecord.status || "").toLowerCase();
  if (PB_ALLOWED_API_KEY_STATUS.size && !PB_ALLOWED_API_KEY_STATUS.has(keyStatus)) {
    return { allowed: false, code: 403, error: "API key is inactive." };
  }

  if (keyRecord.expires === true) {
    const expirationDate = normalizeDate(keyRecord.expiration_date);
    if (!expirationDate || expirationDate.getTime() <= Date.now()) {
      return { allowed: false, code: 403, error: "API key has expired." };
    }
  }

  const accountId = getRelationId(keyRecord.account);
  if (!accountId) {
    return { allowed: false, code: 403, error: "API key is not linked to an account." };
  }

  const account = await pocketBaseRequest(
    `/api/collections/${encodeURIComponent(PB_COLLECTION_ACCOUNT)}/records/${encodeURIComponent(accountId)}`
  );

  if (PB_ALLOWED_SUB_STATUSES.size) {
    const subStatus = String(account.stripe_sub_status || "").toLowerCase();
    if (!PB_ALLOWED_SUB_STATUSES.has(subStatus)) {
      return { allowed: false, code: 403, error: "Account subscription is not active." };
    }
  }

  const userId = getRelationId(account.user);
  if (!userId) {
    return { allowed: false, code: 403, error: "Account has no linked user." };
  }

  const user = await pocketBaseRequest(
    `/api/collections/${encodeURIComponent(PB_COLLECTION_USERS)}/records/${encodeURIComponent(userId)}`
  );

  if (PB_REQUIRE_VERIFIED_USER && user.verified !== true) {
    return { allowed: false, code: 403, error: "User is not verified." };
  }

  return {
    allowed: true,
    context: {
      accountId,
      userId,
      apiKeyId: keyRecord.id,
      role: account.role || null
    }
  };
}

function validateApiKeyWithStaticList(apiKey) {
  const rawKeys = process.env.API_KEYS || "";
  if (!rawKeys) {
    return { allowed: false, code: 503, error: "API is not configured. Contact the administrator." };
  }

  const validKeys = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
  if (!validKeys.includes(apiKey)) {
    return { allowed: false, code: 403, error: "Invalid API key." };
  }

  return { allowed: true, context: {} };
}

module.exports = async function authMiddleware(req, res, next) {
  const provided = req.headers["x-api-key"];
  if (!provided) {
    return res.status(401).json({
      status: 401,
      error: "Missing API key. Provide it via the x-api-key header."
    });
  }

  try {
    const result = PB_URL
      ? await validateApiKeyWithPocketBase(provided)
      : validateApiKeyWithStaticList(provided);

    if (!result.allowed) {
      return res.status(result.code || 403).json({
        status: result.code || 403,
        error: result.error || "Unauthorized."
      });
    }

    req.auth = {
      ...(req.auth || {}),
      ...(result.context || {})
    };

    return next();
  } catch (err) {
    console.error("[auth] validation error:", err.message);

    if (PB_FAIL_CLOSED) {
      return res.status(503).json({
        status: 503,
        error: "Authentication service unavailable."
      });
    }

    if (PB_URL) {
      const fallback = validateApiKeyWithStaticList(provided);
      if (!fallback.allowed) {
        return res.status(fallback.code || 403).json({
          status: fallback.code || 403,
          error: fallback.error || "Unauthorized."
        });
      }

      req.auth = {
        ...(req.auth || {}),
        ...(fallback.context || {})
      };
      return next();
    }

    return res.status(500).json({
      status: 500,
      error: "Internal server error"
    });
  }
};
