const PB_URL = (process.env.PB_URL || "").trim().replace(/\/+$/, "");
const PB_ADMIN_EMAIL = (process.env.PB_ADMIN_EMAIL || "").trim();
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";
const PB_COLLECTION_USAGE_LOGS = (process.env.PB_COLLECTION_USAGE_LOGS || "usage_logs").trim();
const PB_USAGE_LOGGING_ENABLED = toBool(process.env.PB_USAGE_LOGGING_ENABLED, true);
const PB_USAGE_LOG_API_KEY_FIELD = (process.env.PB_USAGE_LOG_API_KEY_FIELD || "api_key").trim();
const PB_USAGE_LOG_RESPONSE_CODE_FIELD = (process.env.PB_USAGE_LOG_RESPONSE_CODE_FIELD || "response_code").trim();
const PB_USAGE_LOG_CREDIT_FIELD = (process.env.PB_USAGE_LOG_CREDIT_FIELD || "credit_used").trim();
const PB_USAGE_LOG_ENDPOINT_FIELD = (process.env.PB_USAGE_LOG_ENDPOINT_FIELD || "endpoint").trim();
const PB_USAGE_LOG_METHOD_FIELD = (process.env.PB_USAGE_LOG_METHOD_FIELD || "method").trim();
const PB_USAGE_LOG_ACCOUNT_FIELD = (process.env.PB_USAGE_LOG_ACCOUNT_FIELD || "account_id").trim();
const PB_USAGE_LOG_TIMESTAMP_FIELD = (process.env.PB_USAGE_LOG_TIMESTAMP_FIELD || "timestamp").trim();
const PB_USAGE_LOG_LATENCY_FIELD = (process.env.PB_USAGE_LOG_LATENCY_FIELD || "latency_ms").trim();
const PB_USAGE_LOG_USER_AGENT_FIELD = (process.env.PB_USAGE_LOG_USER_AGENT_FIELD || "user_agent").trim();
const PB_USAGE_LOG_IP_FIELD = (process.env.PB_USAGE_LOG_IP_FIELD || "ip_address").trim();

const pbSession = {
  token: ""
};

const pbAuthPaths = [
  "/api/admins/auth-with-password",
  "/api/collections/_superusers/auth-with-password"
];

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isConfigured() {
  return Boolean(
    PB_USAGE_LOGGING_ENABLED
      && PB_URL
      && PB_ADMIN_EMAIL
      && PB_ADMIN_PASSWORD
      && PB_COLLECTION_USAGE_LOGS
  );
}

function normalizeEndpoint(req) {
  const base = req.baseUrl || "";
  const path = req.path || "";
  let endpoint = `${base}${path}`;
  if (!endpoint) endpoint = req.originalUrl || "";
  if (!endpoint.startsWith("/")) endpoint = `/${endpoint}`;
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function normalizeIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[0] || "").trim();
  }
  return req.ip || "";
}

function getCreditUsed(req, res) {
  if (normalizeEndpoint(req) === "/v2/usage") return 0;
  if (res.statusCode >= 500) return 0;
  return 1;
}

async function authenticatePocketBase(forceRefresh) {
  if (!forceRefresh && pbSession.token) return pbSession.token;

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
        lastError = new Error(`PocketBase auth failed (${response.status}) on ${authPath}`);
        continue;
      }

      const data = await response.json();
      if (!data || !data.token) {
        lastError = new Error(`PocketBase auth succeeded on ${authPath} but token was missing.`);
        continue;
      }

      pbSession.token = data.token;
      return data.token;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("PocketBase authentication failed.");
}

async function createUsageRecord(record, retry = true) {
  const token = await authenticatePocketBase(false);
  const response = await fetch(
    `${PB_URL}/api/collections/${encodeURIComponent(PB_COLLECTION_USAGE_LOGS)}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(record)
    }
  );

  if (response.status === 401 && retry) {
    await authenticatePocketBase(true);
    return createUsageRecord(record, false);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`usage log write failed (${response.status}): ${text}`);
  }
}

function setField(record, fieldName, value) {
  if (!fieldName) return;
  record[fieldName] = value;
}

function buildUsageRecord(req, res, accountId, apiKey, startedAt, includeExtended) {
  const record = {};
  setField(record, PB_USAGE_LOG_API_KEY_FIELD, apiKey);
  setField(record, PB_USAGE_LOG_RESPONSE_CODE_FIELD, String(res.statusCode || 0));
  setField(record, PB_USAGE_LOG_CREDIT_FIELD, getCreditUsed(req, res));
  setField(record, PB_USAGE_LOG_ENDPOINT_FIELD, normalizeEndpoint(req));
  setField(record, PB_USAGE_LOG_METHOD_FIELD, req.method || "");
  setField(record, PB_USAGE_LOG_ACCOUNT_FIELD, accountId);

  if (includeExtended) {
    setField(record, PB_USAGE_LOG_TIMESTAMP_FIELD, new Date().toISOString());
    setField(record, PB_USAGE_LOG_LATENCY_FIELD, Date.now() - startedAt);
    setField(record, PB_USAGE_LOG_USER_AGENT_FIELD, String(req.headers["user-agent"] || ""));
    setField(record, PB_USAGE_LOG_IP_FIELD, normalizeIp(req));
  }

  return record;
}

function createUsageLoggerMiddleware() {
  if (!isConfigured()) {
    return function usageLoggerDisabled(req, res, next) {
      return next();
    };
  }

  return function usageLogger(req, res, next) {
    const startedAt = Date.now();

    res.on("finish", () => {
      const accountId = (req.auth && req.auth.accountId) || "";
      const apiKey = String(req.headers["x-api-key"] || "");
      const fullRecord = buildUsageRecord(req, res, accountId, apiKey, startedAt, true);
      const minimalRecord = buildUsageRecord(req, res, accountId, apiKey, startedAt, false);

      void (async () => {
        try {
          await createUsageRecord(fullRecord);
        } catch (err) {
          if (err && String(err.message || "").includes("(400)")) {
            try {
              await createUsageRecord(minimalRecord);
              return;
            } catch (fallbackErr) {
              console.error("[usage-logger]", fallbackErr.message);
              return;
            }
          }
          console.error("[usage-logger]", err.message);
        }
      })();
    });

    return next();
  };
}

module.exports = createUsageLoggerMiddleware();
module.exports.createUsageLoggerMiddleware = createUsageLoggerMiddleware;
