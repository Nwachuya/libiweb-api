const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function hasHtmlContent(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof value.html === "string"
    && value.html.trim() !== "";
}

function normalizeHtmlResult(result, fallbackUrl) {
  return {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null,
    html: result.html
  };
}

function createGetHtmlHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getHtmlHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_GETHTML_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Get HTML request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasHtmlContent);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include HTML records.",
        details: upstream.payload
      });
    }

    const items = results.map((result, index) => normalizeHtmlResult(result, targetUrls[index]));
    const totalCharacters = items.reduce((sum, item) => sum + item.html.length, 0);

    return res.status(200).json({
      count: items.length,
      total_characters: totalCharacters,
      items
    });
  };
}

router.post("/", createGetHtmlHandler());

module.exports = router;
module.exports.createGetHtmlHandler = createGetHtmlHandler;
