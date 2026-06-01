const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService,
  isHttpUrl
} = require("../lib/crawl4ai");

const router = express.Router();

function hasMedia(value) {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.media
    && typeof value.media === "object"
    && !Array.isArray(value.media)
  );
}

function normalizeMediaSource(source, baseUrl) {
  if (typeof source !== "string" || !source.trim()) return "";
  const raw = source.trim();
  if (raw.startsWith("data:")) return raw;
  try {
    const resolved = new URL(raw, baseUrl || undefined);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return raw;
  }
}

function normalizeMediaItem(item, fallbackType, sourcePageUrl) {
  if (typeof item === "string") {
    const src = normalizeMediaSource(item, sourcePageUrl);
    if (!src) return null;
    return { src, type: fallbackType };
  }
  if (!item || typeof item !== "object") return null;
  const srcCandidate = item.src || item.href || item.url;
  const src = normalizeMediaSource(srcCandidate, sourcePageUrl);
  if (!src) return null;
  const normalized = {
    src,
    type: typeof item.type === "string" && item.type.trim() ? item.type : fallbackType
  };
  if (typeof item.alt === "string" && item.alt.trim()) normalized.alt = item.alt;
  if (typeof item.format === "string" && item.format.trim()) normalized.format = item.format;
  if (typeof item.score === "number") normalized.score = item.score;
  if (typeof item.width === "number") normalized.width = item.width;
  if (typeof item.height === "number") normalized.height = item.height;
  if (typeof item.group_id === "number") normalized.group_id = item.group_id;
  return normalized;
}

function dedupeMediaItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item || !item.src) continue;
    const key = `${item.type || ""}|${item.src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  deduped.sort((a, b) => {
    if (a.src === b.src) return String(a.type).localeCompare(String(b.type));
    return String(a.src).localeCompare(String(b.src));
  });
  return deduped;
}

function collectMediaByType(results, fallbackUrl) {
  const images = [];
  const videos = [];
  const audios = [];
  for (const result of results) {
    const sourcePageUrl = result.url || result.redirected_url || fallbackUrl || "";
    const media = result.media && typeof result.media === "object" ? result.media : {};
    const pushAll = (target, entries, fallbackType) => {
      if (!Array.isArray(entries)) return;
      for (const entry of entries) {
        const normalized = normalizeMediaItem(entry, fallbackType, sourcePageUrl);
        if (normalized) target.push(normalized);
      }
    };
    pushAll(images, media.images, "image");
    pushAll(videos, media.videos, "video");
    pushAll(audios, media.audios, "audio");
  }
  return {
    images: dedupeMediaItems(images),
    videos: dedupeMediaItems(videos),
    audios: dedupeMediaItems(audios)
  };
}

function createGetMediaHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getMediaHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_GETMEDIA_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Get media request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasMedia);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include media records.",
        details: upstream.payload
      });
    }

    const media = collectMediaByType(results, targetUrl);
    const all = dedupeMediaItems(media.images.concat(media.videos, media.audios));

    return res.status(200).json({
      target: targetUrl,
      counts: {
        total: all.length,
        images: media.images.length,
        videos: media.videos.length,
        audios: media.audios.length
      },
      images: media.images,
      videos: media.videos,
      audios: media.audios,
      all
    });
  };
}

router.post("/", createGetMediaHandler());

module.exports = router;
module.exports.createGetMediaHandler = createGetMediaHandler;
