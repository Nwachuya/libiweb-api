const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_TIMEOUT_MS = 30000;

function parseTimeout(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePath(value, fallback = "/crawl") {
  if (value == null) value = fallback;
  const path = String(value).trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function isHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePayload(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText.slice(0, 8000) };
  }
}

function extractTargetUrls(body) {
  const list = [];
  if (Array.isArray(body && body.urls)) {
    for (const url of body.urls) {
      if (isHttpUrl(url)) list.push(url);
    }
  }
  if (isHttpUrl(body && body.url)) list.push(body.url);
  return Array.from(new Set(list));
}

function normalizeCrawlResults(payload, predicate = () => true) {
  if (payload == null) return [];

  const results = [];
  const pushIfValid = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (predicate(value)) results.push(value);
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (Array.isArray(item)) {
        for (const nested of item) pushIfValid(nested);
      } else {
        pushIfValid(item);
      }
    }
    return results;
  }

  pushIfValid(payload);
  return results;
}

async function postToCrawlService(options) {
  const {
    env,
    fetchImpl,
    pathEnvKey,
    defaultPath = "/crawl",
    body,
    timeoutMessage = "Request timed out."
  } = options;

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      status: 500,
      payload: { status: 500, error: "Fetch API is unavailable." }
    };
  }

  const baseUrl = (env.CRAWL4AI_BASE_URL || DEFAULT_CRAWL4AI_BASE_URL).trim().replace(/\/+$/, "");
  const path = normalizePath(env[pathEnvKey], defaultPath);
  const timeoutMs = parseTimeout(env.CRAWL4AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const upstreamUrl = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let upstream;
  try {
    upstream = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        payload: { status: 504, error: timeoutMessage }
      };
    }

    return {
      ok: false,
      status: 502,
      payload: { status: 502, error: "Unable to reach crawl service." }
    };
  }

  clearTimeout(timeout);
  const raw = await upstream.text();
  const payload = parsePayload(raw);

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      payload: {
        status: upstream.status,
        error: "Crawl service returned an error.",
        details: payload
      }
    };
  }

  return {
    ok: true,
    status: upstream.status,
    payload
  };
}

module.exports = {
  DEFAULT_CRAWL4AI_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  parseTimeout,
  normalizePath,
  isHttpUrl,
  parsePayload,
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
};
