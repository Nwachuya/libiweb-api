const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService,
  isHttpUrl
} = require("../lib/crawl4ai");

const router = express.Router();

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

function hasLinks(value) {
  return value && typeof value === "object" && !Array.isArray(value) && value.links != null;
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

    const upstream = await postToCrawlService({
      env,
      fetchImpl,
      pathEnvKey: "CRAWL4AI_MAP_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Map request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasLinks);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include link maps.",
        details: upstream.payload
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

    // Keep a URL in one bucket only so counts stay coherent.
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
