const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function extractScreenshot(result) {
  if (!result || typeof result !== "object") return null;

  if (typeof result.screenshot === "string" && result.screenshot.trim()) {
    return { screenshot: result.screenshot.trim() };
  }

  if (result.screenshot && typeof result.screenshot === "object" && !Array.isArray(result.screenshot)) {
    const out = {};
    if (typeof result.screenshot.url === "string" && result.screenshot.url.trim()) out.url = result.screenshot.url;
    if (typeof result.screenshot.base64 === "string" && result.screenshot.base64.trim()) {
      out.base64 = result.screenshot.base64;
    }
    if (Object.keys(out).length) return out;
  }

  if (typeof result.screenshot_url === "string" && result.screenshot_url.trim()) {
    return { url: result.screenshot_url };
  }
  if (typeof result.screenshot_base64 === "string" && result.screenshot_base64.trim()) {
    return { base64: result.screenshot_base64 };
  }
  if (typeof result.screenshotBase64 === "string" && result.screenshotBase64.trim()) {
    return { base64: result.screenshotBase64 };
  }

  return null;
}

function hasScreenshot(result) {
  return Boolean(extractScreenshot(result));
}

function createScreenshotHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function screenshotHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_SCREENSHOT_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        screenshot: body.screenshot === false ? false : true,
        urls: targetUrls
      },
      timeoutMessage: "Screenshot request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasScreenshot);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include screenshot records.",
        details: upstream.payload
      });
    }

    const items = results.map((result, index) => ({
      url: result.url || result.redirected_url || targetUrls[index] || null,
      redirected_url: result.redirected_url || null,
      success: result.success === true,
      status_code: result.status_code ?? null,
      screenshot: extractScreenshot(result)
    }));

    return res.status(200).json({
      count: items.length,
      items
    });
  };
}

router.post("/", createScreenshotHandler());

module.exports = router;
module.exports.createScreenshotHandler = createScreenshotHandler;
