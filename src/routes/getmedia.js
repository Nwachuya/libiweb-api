const express = require("express");

const DEFAULT_CRAWL4AI_BASE_URL = "http://m4oco0sgog08o040g8o0os8o.69.62.114.245.sslip.io";
const DEFAULT_CRAWL4AI_GETMEDIA_PATH = "/crawl";
const DEFAULT_TIMEOUT_MS = 30000;

const router = express.Router();

function parseTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function normalizePath(value) {
  if (value == null) value = DEFAULT_CRAWL4AI_GETMEDIA_PATH;
  const path = String(value).trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function isHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePayload(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText.slice(0, 8000) };
  }
}

function extractTargetUrls(body) {
  const list = [];
  if (Array.isArray(body.urls)) {
    for (const url of body.urls) {
      if (isHttpUrl(url)) list.push(url);
    }
  }
  if (isHttpUrl(body.url)) list.push(body.url);
  return Array.from(new Set(list));
}

function normalizeCrawlResults(payload) {
  if (payload == null) return [];

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (payload.results != null) return normalizeCrawlResults(payload.results);
    if (payload.result != null) return normalizeCrawlResults(payload.result);
  }

  const hasMedia = (value) => (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.media
    && typeof value.media === "object"
    && !Array.isArray(value.media)
  );

  if (Array.isArray(payload)) {
    const results = [];
    for (const item of payload) {
      if (Array.isArray(item)) {
        for (const nested of item) {
          if (hasMedia(nested)) results.push(nested);
        }
      } else if (hasMedia(item)) {
        results.push(item);
      }
    }
    return results;
  }

  if (hasMedia(payload)) return [payload];
  return [];
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

    if (typeof fetchImpl !== "function") {
      return res.status(500).json({
        status: 500,
        error: "Fetch API is unavailable."
      });
    }

    const baseUrl = (env.CRAWL4AI_BASE_URL || DEFAULT_CRAWL4AI_BASE_URL).trim().replace(/\/+$/, "");
    const path = normalizePath(env.CRAWL4AI_GETMEDIA_PATH);
    const timeoutMs = parseTimeout(env.CRAWL4AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const upstreamUrl = `${baseUrl}${path}`;

    const upstreamBody = {
      ...body,
      urls: targetUrls
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let upstream;
    try {
      upstream = await fetchImpl(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && err.name === "AbortError") {
        return res.status(504).json({
          status: 504,
          error: "Get media request timed out."
        });
      }
      return res.status(502).json({
        status: 502,
        error: "Unable to reach crawl service."
      });
    }

    clearTimeout(timeout);
    const raw = await upstream.text();
    const payload = parsePayload(raw);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: upstream.status,
        error: "Crawl service returned an error.",
        details: payload
      });
    }

    const results = normalizeCrawlResults(payload);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include media records.",
        details: payload
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
