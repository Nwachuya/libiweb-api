const express = require("express");

const router = express.Router();

function escapeFilterValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getPeriodStartISO(periodValue) {
  if (typeof periodValue === "string" && /^\d{4}-\d{2}$/.test(periodValue)) {
    return new Date(`${periodValue}-01T00:00:00.000Z`);
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function formatPeriod(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function authenticatePocketBase(env, fetchImpl) {
  const baseUrl = (env.PB_URL || "").trim().replace(/\/+$/, "");
  const email = (env.PB_ADMIN_EMAIL || "").trim();
  const password = env.PB_ADMIN_PASSWORD || "";
  const authPaths = [
    "/api/admins/auth-with-password",
    "/api/collections/_superusers/auth-with-password"
  ];

  if (!baseUrl || !email || !password) {
    throw new Error("PocketBase auth is not configured.");
  }

  let lastError = null;
  for (const authPath of authPaths) {
    try {
      const response = await fetchImpl(`${baseUrl}${authPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: email,
          email,
          password
        })
      });

      if (!response.ok) {
        lastError = new Error(`PocketBase auth failed (${response.status})`);
        continue;
      }

      const payload = await response.json();
      if (payload && payload.token) return payload.token;
      lastError = new Error("PocketBase auth returned no token.");
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("PocketBase auth failed.");
}

async function listUsageLogs(options) {
  const {
    env,
    fetchImpl,
    token,
    filter,
    perPage = 200
  } = options;

  const baseUrl = (env.PB_URL || "").trim().replace(/\/+$/, "");
  const collection = (env.PB_COLLECTION_USAGE_LOGS || "usage_logs").trim();

  let page = 1;
  const items = [];
  while (page <= 20) {
    const search = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      filter
    });

    const response = await fetchImpl(
      `${baseUrl}/api/collections/${encodeURIComponent(collection)}/records?${search.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`PocketBase usage query failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    const pageItems = Array.isArray(payload.items) ? payload.items : [];
    items.push(...pageItems);

    const totalPages = Number(payload.totalPages || 1);
    if (page >= totalPages) break;
    page += 1;
  }

  return items;
}

function summarizeUsage(items) {
  const endpointAgg = new Map();
  const statusAgg = new Map();
  let totalCredits = 0;

  for (const item of items) {
    const endpoint = String(item.endpoint || "unknown");
    const creditUsed = Number(item.credit_used || 0);
    const status = String(item.response_code || "unknown");

    totalCredits += Number.isFinite(creditUsed) ? creditUsed : 0;

    if (!endpointAgg.has(endpoint)) {
      endpointAgg.set(endpoint, { endpoint, requests: 0, credits: 0 });
    }
    const entry = endpointAgg.get(endpoint);
    entry.requests += 1;
    entry.credits += Number.isFinite(creditUsed) ? creditUsed : 0;

    statusAgg.set(status, (statusAgg.get(status) || 0) + 1);
  }

  const endpoints = Array.from(endpointAgg.values()).sort((a, b) => b.requests - a.requests);
  const status_codes = {};
  for (const [code, count] of statusAgg.entries()) status_codes[code] = count;

  return {
    total_requests: items.length,
    total_credits: totalCredits,
    endpoints,
    status_codes
  };
}

function createUsageHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function usageHandler(req, res) {
    const pbUrl = (env.PB_URL || "").trim();
    if (!pbUrl) {
      return res.status(503).json({
        status: 503,
        error: "Usage service requires PocketBase configuration."
      });
    }

    const periodStart = getPeriodStartISO(req.query && req.query.period);
    if (Number.isNaN(periodStart.getTime())) {
      return res.status(400).json({
        status: 400,
        error: "Invalid period format. Use YYYY-MM."
      });
    }

    const accountId = req.auth && req.auth.accountId;
    const apiKey = req.headers["x-api-key"];
    const scope = (req.query && String(req.query.scope || "key").toLowerCase()) || "key";

    if (scope === "account" && !accountId) {
      return res.status(400).json({
        status: 400,
        error: "Account scope requires account context."
      });
    }

    if (scope !== "account" && !apiKey) {
      return res.status(400).json({
        status: 400,
        error: "Missing API key in request."
      });
    }

    const baseFilter = `created >= "${periodStart.toISOString()}"`;
    const scopedFilter = scope === "account"
      ? `account_id = "${escapeFilterValue(accountId)}"`
      : `api_key = "${escapeFilterValue(apiKey)}"`;
    const filter = `${scopedFilter} && ${baseFilter}`;

    try {
      const token = await authenticatePocketBase(env, fetchImpl);
      const items = await listUsageLogs({
        env,
        fetchImpl,
        token,
        filter
      });

      const summary = summarizeUsage(items);
      return res.status(200).json({
        period: formatPeriod(periodStart),
        scope,
        ...summary
      });
    } catch (err) {
      return res.status(502).json({
        status: 502,
        error: "Failed to load usage data.",
        details: err.message
      });
    }
  };
}

router.get("/", createUsageHandler());

module.exports = router;
module.exports.createUsageHandler = createUsageHandler;
