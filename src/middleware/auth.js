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
const PB_COLLECTION_PLANS = (process.env.PB_COLLECTION_PLANS || "plans").trim();
const PB_COLLECTION_USAGE_LOGS = (process.env.PB_COLLECTION_USAGE_LOGS || "usage_logs").trim();

const PB_REQUIRE_VERIFIED_USER = toBool(process.env.PB_REQUIRE_VERIFIED_USER, true);
const PB_FAIL_CLOSED = toBool(process.env.PB_FAIL_CLOSED, true);
const PB_ALLOWED_API_KEY_STATUS = toSet(process.env.PB_ALLOWED_API_KEY_STATUS || "active");
const PB_ALLOWED_SUB_STATUSES = toSet(process.env.PB_ALLOWED_SUB_STATUSES || "");
const PB_AUTH_DEBUG = toBool(process.env.PB_AUTH_DEBUG, false);
const PB_ENFORCE_ENDPOINT_ALLOWLIST = toBool(process.env.PB_ENFORCE_ENDPOINT_ALLOWLIST, true);
const PB_ENFORCE_MONTHLY_CREDITS = toBool(process.env.PB_ENFORCE_MONTHLY_CREDITS, true);
const PB_CREDIT_CHECK_EXEMPT_ENDPOINTS = toSet(
  process.env.PB_CREDIT_CHECK_EXEMPT_ENDPOINTS || "/v2/health,/v2/status,/v2/usage"
);

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

function normalizeEndpoint(req) {
  let endpoint = String((req && (req.originalUrl || req.url || req.path)) || "").trim();
  const q = endpoint.indexOf("?");
  if (q >= 0) endpoint = endpoint.slice(0, q);
  if (!endpoint.startsWith("/")) endpoint = `/${endpoint}`;
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint.toLowerCase();
}

function parseNumberOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeAllowedEndpoints(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // fallthrough to comma-separated parsing
    }

    return raw.split(",").map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  }

  return [];
}

function endpointMatchesRule(endpoint, rule) {
  if (!rule) return false;
  if (rule === "*") return true;
  if (rule.endsWith("*")) {
    const prefix = rule.slice(0, -1);
    return endpoint.startsWith(prefix);
  }
  if (endpoint === rule) return true;
  return endpoint.startsWith(`${rule}/`);
}

function getRequestCreditCost(req) {
  if (String((req && req.method) || "").toUpperCase() === "OPTIONS") return 0;
  const endpoint = normalizeEndpoint(req);
  if (PB_CREDIT_CHECK_EXEMPT_ENDPOINTS.has(endpoint)) return 0;
  return 1;
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

async function fetchPlanRecord(account) {
  const planId = getRelationId(account && account.plan);
  if (!planId) return null;

  return pocketBaseRequest(
    `/api/collections/${encodeURIComponent(PB_COLLECTION_PLANS)}/records/${encodeURIComponent(planId)}`
  );
}

async function getMonthlyUsedCredits(accountId) {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);

  const filter = [
    `account_id = "${escapeFilterValue(accountId)}"`,
    `created >= "${periodStart.toISOString()}"`
  ].join(" && ");

  let page = 1;
  let total = 0;
  while (page <= 20) {
    const search = new URLSearchParams({
      page: String(page),
      perPage: "200",
      filter
    });

    const payload = await pocketBaseRequest(
      `/api/collections/${encodeURIComponent(PB_COLLECTION_USAGE_LOGS)}/records?${search.toString()}`
    );

    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    for (const item of items) {
      const used = Number(item && item.credit_used);
      if (Number.isFinite(used) && used > 0) total += used;
    }

    const totalPages = Number(payload && payload.totalPages) || 1;
    if (page >= totalPages) break;
    page += 1;
  }

  return total;
}

function resolveAllowedEndpoints(keyRecord, plan) {
  const keyOverrides = normalizeAllowedEndpoints(keyRecord && keyRecord.allowed_endpoints_override);
  if (keyOverrides.length) return keyOverrides;
  return normalizeAllowedEndpoints(plan && plan.allowed_endpoints);
}

async function validateApiKeyWithPocketBase(apiKey, req) {
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

  if (normalizeDate(keyRecord.revoked_at)) {
    return { allowed: false, code: 403, error: "API key is revoked." };
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

  const keyAllowedEndpoints = resolveAllowedEndpoints(keyRecord, null);
  const keyMonthlyCreditLimit = parseNumberOrNull(keyRecord && keyRecord.monthly_credits_override);
  const hasPlanRelation = Boolean(getRelationId(account.plan));
  const needsPlan = hasPlanRelation
    && (
      (PB_ENFORCE_ENDPOINT_ALLOWLIST && !keyAllowedEndpoints.length)
      || PB_ENFORCE_MONTHLY_CREDITS
    );

  const plan = needsPlan ? await fetchPlanRecord(account) : null;
  const planMonthlyCreditLimit = parseNumberOrNull(plan && plan.monthly_credits);
  const requestEndpoint = normalizeEndpoint(req);

  if (PB_ENFORCE_ENDPOINT_ALLOWLIST) {
    const allowedEndpoints = keyAllowedEndpoints.length
      ? keyAllowedEndpoints
      : resolveAllowedEndpoints(null, plan);
    if (allowedEndpoints.length) {
      const allowed = allowedEndpoints.some((rule) => endpointMatchesRule(requestEndpoint, rule));
      if (!allowed) {
        return {
          allowed: false,
          code: 403,
          error: `Endpoint not allowed for this API key: ${requestEndpoint}`
        };
      }
    }
  }

  const requestCreditCost = getRequestCreditCost(req);
  let usedCredits = null;
  let monthlyCreditLimit = null;
  const hasAnyCreditLimit = (planMonthlyCreditLimit != null) || (keyMonthlyCreditLimit != null);
  if (PB_ENFORCE_MONTHLY_CREDITS && requestCreditCost > 0 && hasAnyCreditLimit) {
    usedCredits = await getMonthlyUsedCredits(accountId);
    const projected = usedCredits + requestCreditCost;

    if (planMonthlyCreditLimit != null) {
      monthlyCreditLimit = planMonthlyCreditLimit;
      if (projected > planMonthlyCreditLimit) {
        // Plan limit is primary. Only if exceeded, check key-level secondary override.
        if (keyMonthlyCreditLimit != null && projected <= keyMonthlyCreditLimit) {
          monthlyCreditLimit = keyMonthlyCreditLimit;
        } else {
          return {
            allowed: false,
            code: 429,
            error: "Monthly credit limit exceeded."
          };
        }
      }
    } else if (keyMonthlyCreditLimit != null) {
      monthlyCreditLimit = keyMonthlyCreditLimit;
      if (projected > keyMonthlyCreditLimit) {
        return {
          allowed: false,
          code: 429,
          error: "Monthly credit limit exceeded."
        };
      }
    }

    if (monthlyCreditLimit != null && projected > monthlyCreditLimit) {
      return {
        allowed: false,
        code: 429,
        error: "Monthly credit limit exceeded."
      };
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
      role: account.role || null,
      planId: getRelationId(account.plan) || null,
      monthlyCreditLimit,
      usedCredits
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
      ? await validateApiKeyWithPocketBase(provided, req)
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
        error: "Authentication service unavailable.",
        ...(PB_AUTH_DEBUG ? { details: err.message } : {})
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
