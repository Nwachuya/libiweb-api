const express = require("express");

const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_CRAWL4AI_PATH = "/crawl";
const DEFAULT_TIMEOUT_MS = 30000;

const router = express.Router();

function normalizePath(value, fallback) {
  if (value == null) value = fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function isValidHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseResponsePayload(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText.slice(0, 8000) };
  }
}

function extractTargetUrls(body) {
  const list = [];
  if (Array.isArray(body.urls)) {
    for (const url of body.urls) {
      if (isValidHttpUrl(url)) list.push(url);
    }
  }
  if (isValidHttpUrl(body.url)) list.push(body.url);
  return Array.from(new Set(list));
}

function createCrawlHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function crawlHandler(req, res) {
    const baseUrl = (env.CRAWL4AI_BASE_URL || DEFAULT_CRAWL4AI_BASE_URL).trim().replace(/\/+$/, "");
    const upstreamPath = normalizePath(env.CRAWL4AI_PATH, DEFAULT_CRAWL4AI_PATH);
    const timeoutMs = parseTimeout(env.CRAWL4AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const targetUrl = `${baseUrl}${upstreamPath}`;

    if (!baseUrl) {
      return res.status(503).json({
        status: 503,
        error: "Crawl service is not configured."
      });
    }

    if (typeof fetchImpl !== "function") {
      return res.status(500).json({
        status: 500,
        error: "Fetch API is unavailable."
      });
    }

    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);

    if (!targetUrls.length) {
      return res.status(400).json({
        status: 400,
        error: "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
      });
    }

    const upstreamBody = {
      ...body,
      urls: targetUrls
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let upstream;
    try {
      upstream = await fetchImpl(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && err.name === "AbortError") {
        return res.status(504).json({
          status: 504,
          error: "Crawl request timed out."
        });
      }
      return res.status(502).json({
        status: 502,
        error: "Unable to reach crawl service."
      });
    }

    clearTimeout(timeout);
    const raw = await upstream.text();
    const payload = parseResponsePayload(raw);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: upstream.status,
        error: "Crawl service returned an error.",
        details: payload
      });
    }

    return res.status(upstream.status).json(payload);
  };
}

router.post("/", createCrawlHandler());

module.exports = router;
module.exports.createCrawlHandler = createCrawlHandler;
