const express = require("express");

const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_CRAWL4AI_MAP_PATH = "/crawl";
const DEFAULT_TIMEOUT_MS = 30000;

const router = express.Router();

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function normalizePath(value) {
  if (value == null) value = DEFAULT_CRAWL4AI_MAP_PATH;
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

function normalizeCrawlResults(payload) {
  if (payload == null) return [];

  // Observed sample shape: [[{...crawl result...}]]
  if (Array.isArray(payload)) {
    const results = [];
    for (const item of payload) {
      if (Array.isArray(item)) {
        for (const nested of item) {
          if (nested && typeof nested === "object" && nested.links) results.push(nested);
        }
      } else if (item && typeof item === "object" && item.links) {
        results.push(item);
      }
    }
    return results;
  }

  if (payload && typeof payload === "object" && payload.links) {
    return [payload];
  }

  return [];
}

function pluckUrls(entries) {
  if (!Array.isArray(entries)) return [];

  const urls = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      if (isHttpUrl(entry)) urls.push(entry);
      continue;
    }

    if (entry && typeof entry === "object" && isHttpUrl(entry.href)) {
      urls.push(entry.href);
    }
  }

  return urls;
}

function dedupeAndSort(urls) {
  return Array.from(new Set(urls)).sort();
}

function normalizeForDedupe(rawUrl) {
  if (!isHttpUrl(rawUrl)) return "";
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    if (u.pathname.endsWith("/") && u.pathname !== "/") {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return "";
  }
}

function dedupeNormalized(urls) {
  const normalized = [];
  for (const url of urls) {
    const value = normalizeForDedupe(url);
    if (value) normalized.push(value);
  }
  return dedupeAndSort(normalized);
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

function createMapHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function mapHandler(req, res) {
    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);
    const targetUrl = targetUrls[0];

    if (!targetUrl) {
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
    const path = normalizePath(env.CRAWL4AI_MAP_PATH);
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
          error: "Map request timed out."
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
        error: "Crawl service response did not include link maps.",
        details: payload
      });
    }

    let internal = [];
    let external = [];

    for (const result of results) {
      internal = internal.concat(pluckUrls(result.links && result.links.internal));
      external = external.concat(pluckUrls(result.links && result.links.external));
    }

    internal = dedupeNormalized(internal);
    external = dedupeNormalized(external);

    // If upstream returns overlaps, keep a URL in a single bucket so counts stay coherent.
    const internalSet = new Set(internal);
    external = external.filter((url) => !internalSet.has(url));
    const all = dedupeAndSort(internal.concat(external));

    return res.status(200).json({
      target: targetUrl,
      counts: {
        total: all.length,
        internal: internal.length,
        external: external.length
      },
      internal,
      external,
      all
    });
  };
}

router.post("/", createMapHandler());

module.exports = router;
module.exports.createMapHandler = createMapHandler;
