const express = require("express");

const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_CRAWL4AI_GETMARKDOWN_PATH = "/crawl";
const DEFAULT_TIMEOUT_MS = 30000;

const router = express.Router();

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function normalizePath(value) {
  if (value == null) value = DEFAULT_CRAWL4AI_GETMARKDOWN_PATH;
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

function hasMarkdownContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  if (typeof value.markdown === "string" && value.markdown.trim()) return true;

  const markdown = value.markdown;
  if (!markdown || typeof markdown !== "object" || Array.isArray(markdown)) return false;

  return (
    (typeof markdown.raw_markdown === "string" && markdown.raw_markdown.trim())
    || (typeof markdown.markdown_with_citations === "string" && markdown.markdown_with_citations.trim())
    || (typeof markdown.references_markdown === "string" && markdown.references_markdown.trim())
    || (typeof markdown.fit_markdown === "string" && markdown.fit_markdown.trim())
  );
}

function normalizeCrawlResults(payload) {
  if (payload == null) return [];

  if (Array.isArray(payload)) {
    const results = [];
    for (const item of payload) {
      if (Array.isArray(item)) {
        for (const nested of item) {
          if (hasMarkdownContent(nested)) results.push(nested);
        }
      } else if (hasMarkdownContent(item)) {
        results.push(item);
      }
    }
    return results;
  }

  if (hasMarkdownContent(payload)) return [payload];
  return [];
}

function pickMarkdownText(result) {
  if (typeof result.markdown === "string") return result.markdown;

  const markdown = result.markdown && typeof result.markdown === "object" ? result.markdown : {};
  if (typeof markdown.raw_markdown === "string" && markdown.raw_markdown.trim()) return markdown.raw_markdown;
  if (typeof markdown.markdown_with_citations === "string" && markdown.markdown_with_citations.trim()) {
    return markdown.markdown_with_citations;
  }
  if (typeof markdown.fit_markdown === "string" && markdown.fit_markdown.trim()) return markdown.fit_markdown;
  return "";
}

function normalizeMarkdownResult(result, fallbackUrl) {
  const markdown = result.markdown && typeof result.markdown === "object" && !Array.isArray(result.markdown)
    ? result.markdown
    : {};

  const normalized = {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null,
    markdown: pickMarkdownText(result)
  };

  if (typeof markdown.markdown_with_citations === "string" && markdown.markdown_with_citations.trim()) {
    normalized.markdown_with_citations = markdown.markdown_with_citations;
  }
  if (typeof markdown.references_markdown === "string" && markdown.references_markdown.trim()) {
    normalized.references_markdown = markdown.references_markdown;
  }
  if (typeof markdown.fit_markdown === "string" && markdown.fit_markdown.trim()) {
    normalized.fit_markdown = markdown.fit_markdown;
  }

  return normalized;
}

function createGetMarkdownHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getMarkdownHandler(req, res) {
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
    const path = normalizePath(env.CRAWL4AI_GETMARKDOWN_PATH);
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
          error: "Get markdown request timed out."
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
        error: "Crawl service response did not include markdown records.",
        details: payload
      });
    }

    const items = results.map((result, index) => normalizeMarkdownResult(result, targetUrls[index]));
    const totalCharacters = items.reduce((sum, item) => sum + item.markdown.length, 0);

    return res.status(200).json({
      count: items.length,
      total_characters: totalCharacters,
      items
    });
  };
}

router.post("/", createGetMarkdownHandler());

module.exports = router;
module.exports.createGetMarkdownHandler = createGetMarkdownHandler;
