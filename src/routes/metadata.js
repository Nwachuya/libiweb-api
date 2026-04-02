const express = require("express");

const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_CRAWL4AI_METADATA_PATH = "/crawl";
const DEFAULT_TIMEOUT_MS = 30000;

const router = express.Router();

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function normalizePath(value) {
  if (value == null) value = DEFAULT_CRAWL4AI_METADATA_PATH;
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
  if (Array.isArray(body.urls)) {
    for (const url of body.urls) {
      if (isHttpUrl(url)) list.push(url);
    }
  }
  if (isHttpUrl(body.url)) list.push(body.url);
  return Array.from(new Set(list));
}

function normalizeCrawlResults(payload) {
  const isMetadataRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (typeof value.url === "string" && value.url.trim()) return true;
    if (typeof value.redirected_url === "string" && value.redirected_url.trim()) return true;
    if (typeof value.status_code === "number") return true;
    if (value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)) return true;
    return false;
  };

  if (payload == null) return [];

  if (Array.isArray(payload)) {
    const results = [];
    for (const item of payload) {
      if (Array.isArray(item)) {
        for (const nested of item) {
          if (isMetadataRecord(nested)) results.push(nested);
        }
      } else if (isMetadataRecord(item)) {
        results.push(item);
      }
    }
    return results;
  }

  if (isMetadataRecord(payload)) {
    return [payload];
  }

  return [];
}

function normalizeMetadataResult(result, fallbackUrl) {
  const metadata = result && typeof result.metadata === "object" && !Array.isArray(result.metadata)
    ? result.metadata
    : {};

  return {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null,
    metadata
  };
}

function createMetadataHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function metadataHandler(req, res) {
    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);

    if (!targetUrls.length) {
      return res.status(400).json({
        status: 400,
        error: "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
      });
    }

    if (typeof fetchImpl !== "function") {
      return res.status(500).json({
        status: 500,
        error: "Fetch API is unavailable."
      });
    }

    const baseUrl = (env.CRAWL4AI_BASE_URL || DEFAULT_CRAWL4AI_BASE_URL).trim().replace(/\/+$/, "");
    const path = normalizePath(env.CRAWL4AI_METADATA_PATH);
    const timeoutMs = parseTimeout(env.CRAWL4AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const upstreamUrl = `${baseUrl}${path}`;

    const upstreamBody = {
      ...body,
      urls: targetUrls
    };

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
        body: JSON.stringify(upstreamBody),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && err.name === "AbortError") {
        return res.status(504).json({
          status: 504,
          error: "Metadata request timed out."
        });
      }
      return res.status(502).json({
        status: 502,
        error: "Unable to reach crawl service."
      });
    }

    clearTimeout(timeout);
    const raw = await upstream.text();
    const payload = parsePayload(raw);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: upstream.status,
        error: "Crawl service returned an error.",
        details: payload
      });
    }

    const results = normalizeCrawlResults(payload);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include metadata records.",
        details: payload
      });
    }

    const items = results.map((result, index) => normalizeMetadataResult(result, targetUrls[index]));

    return res.status(200).json({
      count: items.length,
      items
    });
  };
}

router.post("/", createMetadataHandler());

module.exports = router;
module.exports.createMetadataHandler = createMetadataHandler;
