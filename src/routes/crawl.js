const express = require("express");
const {
  extractTargetUrls,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function createCrawlHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function crawlHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Crawl request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    return res.status(upstream.status).json(upstream.payload);
  };
}

router.post("/", createCrawlHandler());

module.exports = router;
module.exports.createCrawlHandler = createCrawlHandler;
