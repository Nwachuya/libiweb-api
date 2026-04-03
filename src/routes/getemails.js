const express = require("express");
const {
  extractTargetUrls,
  isHttpUrl,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

const CONTACT_PATTERNS = [
  "contact",
  "about",
  "info",
  "support",
  "help",
  "team",
  "company"
];

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function parseMaxPages(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(Math.trunc(parsed), 25);
}

function normalizeUrlForDedupe(value) {
  if (!isHttpUrl(value)) return "";
  try {
    const u = new URL(value);
    u.hash = "";
    if (u.pathname.endsWith("/") && u.pathname !== "/") {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return "";
  }
}

function pickInternalLinks(seedResult) {
  const links = seedResult && seedResult.links && seedResult.links.internal;
  if (!Array.isArray(links)) return [];

  const matched = [];
  for (const item of links) {
    const href = typeof item === "string" ? item : item && item.href;
    if (!isHttpUrl(href)) continue;

    const text = String((item && item.text) || "").toLowerCase();
    const title = String((item && item.title) || "").toLowerCase();
    const hrefText = String(href).toLowerCase();

    const isMatch = CONTACT_PATTERNS.some((pattern) => (
      hrefText.includes(pattern) || text.includes(pattern) || title.includes(pattern)
    ));

    if (isMatch) matched.push(href);
  }

  const deduped = new Set();
  for (const url of matched) {
    const normalized = normalizeUrlForDedupe(url);
    if (normalized) deduped.add(normalized);
  }

  return Array.from(deduped).sort();
}

function getTextForEmailScan(result) {
  if (!result || typeof result !== "object") return "";

  const md = result.markdown && typeof result.markdown === "object" ? result.markdown : {};
  if (typeof md.raw_markdown === "string" && md.raw_markdown.trim()) return md.raw_markdown;
  if (typeof result.markdown === "string" && result.markdown.trim()) return result.markdown;
  if (typeof result.html === "string" && result.html.trim()) return result.html;
  return "";
}

function sanitizeGetEmailsBody(body, urls) {
  const {
    schema,
    regex,
    patterns,
    include_patterns,
    exclude_patterns,
    ...rest
  } = body || {};

  return {
    ...rest,
    urls
  };
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[),.;:!?]+$/g, "")
    .replace(/^mailto:/i, "");
}

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || ""));
}

function extractMailtoEmails(text) {
  const out = new Set();
  const raw = String(text || "");
  const mailto = /mailto:([^"'?\s>]+)/gi;

  for (const match of raw.matchAll(mailto)) {
    let email = match[1] || "";
    try {
      email = decodeURIComponent(email);
    } catch {
      // keep raw when decode fails
    }
    email = normalizeEmail(email);
    if (isValidEmail(email)) out.add(email);
  }

  return out;
}

function extractEmailsFromText(text) {
  const out = new Set();
  const raw = String(text || "");

  const standard = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const match of raw.matchAll(standard)) {
    const email = normalizeEmail(match[0]);
    if (isValidEmail(email)) out.add(email);
  }

  const obfuscated = /([A-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\sat\s)\s*([A-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*([A-Z]{2,})/gi;
  for (const match of raw.matchAll(obfuscated)) {
    const email = normalizeEmail(`${match[1]}@${match[2]}.${match[3]}`);
    if (isValidEmail(email)) out.add(email);
  }

  for (const mailtoEmail of extractMailtoEmails(raw)) out.add(mailtoEmail);
  return out;
}

function extractEmailsFromLinks(result) {
  const out = new Set();
  if (!result || typeof result !== "object") return out;

  const links = result.links && typeof result.links === "object" ? result.links : {};
  const buckets = [links.internal, links.external];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const entry of bucket) {
      const href = typeof entry === "string" ? entry : entry && entry.href;
      if (!href) continue;
      const normalized = normalizeEmail(href);
      if (isValidEmail(normalized)) out.add(normalized);
      for (const email of extractMailtoEmails(String(href))) out.add(email);
    }
  }

  return out;
}

function extractEmails(result) {
  const emails = new Set();

  const text = getTextForEmailScan(result);
  for (const email of extractEmailsFromText(text)) emails.add(email);
  for (const email of extractEmailsFromLinks(result)) emails.add(email);

  return Array.from(emails).sort();
}

function hasCrawlRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function createGetEmailsHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getEmailsHandler(req, res) {
    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);
    const targetUrl = targetUrls[0];

    if (!targetUrl) {
      return res.status(400).json({
        status: 400,
        error: "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
      });
    }

    const maxPages = parseMaxPages(body.max_pages);
    const seedRequestBody = sanitizeGetEmailsBody(body, [targetUrl]);

    const seedUpstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_GETEMAILS_PATH",
      defaultPath: "/crawl",
      body: seedRequestBody,
      timeoutMessage: "Get emails request timed out."
    });

    if (!seedUpstream.ok) return res.status(seedUpstream.status).json(seedUpstream.payload);

    const seedResults = normalizeCrawlResults(seedUpstream.payload, hasCrawlRecord);
    if (!seedResults.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include crawl records.",
        details: seedUpstream.payload
      });
    }

    const candidateUrls = pickInternalLinks(seedResults[0]);
    const pagesToCrawl = Array.from(new Set([targetUrl, ...candidateUrls])).slice(0, maxPages);

    const pageUpstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_GETEMAILS_PATH",
      defaultPath: "/crawl",
      body: {
        ...sanitizeGetEmailsBody(body, pagesToCrawl)
      },
      timeoutMessage: "Get emails request timed out."
    });

    if (!pageUpstream.ok) return res.status(pageUpstream.status).json(pageUpstream.payload);

    const pageResults = normalizeCrawlResults(pageUpstream.payload, hasCrawlRecord);
    if (!pageResults.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include page records.",
        details: pageUpstream.payload
      });
    }

    const emailsToSources = new Map();
    for (const result of pageResults) {
      const sourceUrl = result.url || result.redirected_url || targetUrl;
      const emails = extractEmails(result);

      for (const email of emails) {
        if (!emailsToSources.has(email)) emailsToSources.set(email, new Set());
        emailsToSources.get(email).add(sourceUrl);
      }
    }

    const emails = Array.from(emailsToSources.entries())
      .map(([email, sources]) => ({
        email,
        sources: Array.from(sources).sort()
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    return res.status(200).json({
      target: targetUrl,
      counts: {
        pages_scanned: pagesToCrawl.length,
        candidate_pages: candidateUrls.length,
        emails_found: emails.length
      },
      scanned_pages: pagesToCrawl,
      emails
    });
  };
}

router.post("/", createGetEmailsHandler());

module.exports = router;
module.exports.createGetEmailsHandler = createGetEmailsHandler;
