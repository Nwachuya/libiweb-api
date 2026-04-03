const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

const SUPPORTED_FIELDS = new Set(["emails", "phones", "urls"]);

function stripHtmlTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function getTextSource(result) {
  if (!result || typeof result !== "object") return "";
  const md = result.markdown && typeof result.markdown === "object" ? result.markdown : {};
  if (typeof md.raw_markdown === "string" && md.raw_markdown.trim()) return md.raw_markdown;
  if (typeof result.markdown === "string" && result.markdown.trim()) return result.markdown;
  if (typeof result.html === "string" && result.html.trim()) return stripHtmlTags(result.html);
  return "";
}

function isCrawlRecord(result) {
  return Boolean(getTextSource(result));
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[),.;:!?]+$/g, "")
    .replace(/^mailto:/i, "");
}

function extractEmails(text) {
  const out = new Set();
  const raw = String(text || "");

  const standard = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const match of raw.matchAll(standard)) {
    const email = normalizeEmail(match[0]);
    if (email.includes("@")) out.add(email);
  }

  const obfuscated = /([A-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\sat\s)\s*([A-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*([A-Z]{2,})/gi;
  for (const match of raw.matchAll(obfuscated)) {
    const email = normalizeEmail(`${match[1]}@${match[2]}.${match[3]}`);
    if (email.includes("@")) out.add(email);
  }

  return Array.from(out).sort();
}

function extractPhones(text) {
  const out = new Set();
  const raw = String(text || "");
  const phoneRegex = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
  for (const match of raw.matchAll(phoneRegex)) {
    const value = String(match[0] || "").trim().replace(/\s+/g, " ");
    if (value.length >= 8) out.add(value);
  }
  return Array.from(out).sort();
}

function extractUrls(text) {
  const out = new Set();
  const raw = String(text || "");
  const urlRegex = /https?:\/\/[^\s)>"']+/gi;
  for (const match of raw.matchAll(urlRegex)) {
    const value = String(match[0] || "").replace(/[),.;:!?]+$/g, "");
    out.add(value);
  }
  return Array.from(out).sort();
}

function normalizeFields(fields) {
  if (!Array.isArray(fields) || !fields.length) return ["emails", "phones"];
  const normalized = Array.from(new Set(fields.map((v) => String(v || "").toLowerCase().trim()).filter(Boolean)));
  return normalized.filter((field) => SUPPORTED_FIELDS.has(field));
}

function createExtractHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function extractHandler(req, res) {
    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);

    if (!targetUrls.length) {
      return res.status(400).json({
        status: 400,
        error: "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
      });
    }

    const fields = normalizeFields(body.fields);
    if (!fields.length) {
      return res.status(400).json({
        status: 400,
        error: "Invalid fields. Supported values: emails, phones, urls."
      });
    }

    const upstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_EXTRACT_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Extract request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, isCrawlRecord);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include extractable records.",
        details: upstream.payload
      });
    }

    const items = results.map((result, index) => {
      const text = getTextSource(result);
      const extracted = {};

      if (fields.includes("emails")) extracted.emails = extractEmails(text);
      if (fields.includes("phones")) extracted.phones = extractPhones(text);
      if (fields.includes("urls")) extracted.urls = extractUrls(text);

      return {
        url: result.url || result.redirected_url || targetUrls[index] || null,
        redirected_url: result.redirected_url || null,
        success: result.success === true,
        status_code: result.status_code ?? null,
        extracted
      };
    });

    return res.status(200).json({
      fields,
      count: items.length,
      items
    });
  };
}

router.post("/", createExtractHandler());

module.exports = router;
module.exports.createExtractHandler = createExtractHandler;
