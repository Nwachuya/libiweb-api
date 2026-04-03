const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function pickMarkdown(result) {
  if (!result || typeof result !== "object") return "";
  if (typeof result.markdown === "string" && result.markdown.trim()) return result.markdown;

  const md = result.markdown && typeof result.markdown === "object" ? result.markdown : {};
  if (typeof md.raw_markdown === "string" && md.raw_markdown.trim()) return md.raw_markdown;
  if (typeof md.fit_markdown === "string" && md.fit_markdown.trim()) return md.fit_markdown;
  if (typeof md.markdown_with_citations === "string" && md.markdown_with_citations.trim()) {
    return md.markdown_with_citations;
  }

  return "";
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function markdownToText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTextCandidate(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  if (pickMarkdown(result)) return true;
  return typeof result.html === "string" && result.html.trim() !== "";
}

function normalizeTextResult(result, fallbackUrl) {
  const markdown = pickMarkdown(result);
  const text = markdown
    ? markdownToText(markdown)
    : markdownToText(stripHtmlTags(String(result.html || "")));

  return {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null,
    text
  };
}

function createGetTextHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getTextHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_GETTEXT_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Get text request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasTextCandidate);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include text records.",
        details: upstream.payload
      });
    }

    const items = results.map((result, index) => normalizeTextResult(result, targetUrls[index]));
    const totalCharacters = items.reduce((sum, item) => sum + item.text.length, 0);

    return res.status(200).json({
      count: items.length,
      total_characters: totalCharacters,
      items
    });
  };
}

router.post("/", createGetTextHandler());

module.exports = router;
module.exports.createGetTextHandler = createGetTextHandler;
