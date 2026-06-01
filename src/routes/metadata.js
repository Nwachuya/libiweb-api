const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function isMetadataRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.url === "string" && value.url.trim()) return true;
  if (typeof value.redirected_url === "string" && value.redirected_url.trim()) return true;
  if (typeof value.status_code === "number") return true;
  if (value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)) return true;
  return false;
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

    const upstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_METADATA_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Metadata request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, isMetadataRecord);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include metadata records.",
        details: upstream.payload
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
