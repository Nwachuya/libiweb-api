const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

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

    const upstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_GETMARKDOWN_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Get markdown request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasMarkdownContent);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include markdown records.",
        details: upstream.payload
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
