const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");

const router = express.Router();

function hasSeoCandidate(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  if (result.metadata && typeof result.metadata === "object") return true;
  if (typeof result.html === "string" && result.html.trim()) return true;
  return false;
}

function readAttr(tag, name) {
  const regex = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(regex);
  return match ? match[1].trim() : "";
}

function extractTagContent(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function extractMetaByName(html, name) {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i");
  const match = html.match(regex);
  if (!match) return "";
  return readAttr(match[0], "content");
}

function extractMetaByProperty(html, property) {
  const regex = new RegExp(`<meta[^>]+property=["']${property}["'][^>]*>`, "i");
  const match = html.match(regex);
  if (!match) return "";
  return readAttr(match[0], "content");
}

function extractCanonical(html) {
  const regex = /<link[^>]+rel=["']canonical["'][^>]*>/i;
  const match = html.match(regex);
  if (!match) return "";
  return readAttr(match[0], "href");
}

function extractFromHtml(html) {
  const source = String(html || "");
  return {
    title: extractTagContent(source, "title"),
    description: extractMetaByName(source, "description"),
    keywords: extractMetaByName(source, "keywords"),
    robots: extractMetaByName(source, "robots"),
    canonical: extractCanonical(source),
    og: {
      title: extractMetaByProperty(source, "og:title"),
      description: extractMetaByProperty(source, "og:description"),
      image: extractMetaByProperty(source, "og:image"),
      url: extractMetaByProperty(source, "og:url"),
      type: extractMetaByProperty(source, "og:type")
    },
    twitter: {
      card: extractMetaByName(source, "twitter:card"),
      title: extractMetaByName(source, "twitter:title"),
      description: extractMetaByName(source, "twitter:description"),
      image: extractMetaByName(source, "twitter:image")
    }
  };
}

function normalizeSeoResult(result, fallbackUrl) {
  const htmlSeo = extractFromHtml(result.html);
  const metadata = result.metadata && typeof result.metadata === "object" ? result.metadata : {};

  const ogMeta = metadata.og && typeof metadata.og === "object" ? metadata.og : {};
  const twitterMeta = metadata.twitter && typeof metadata.twitter === "object" ? metadata.twitter : {};

  return {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null,
    seo: {
      title: metadata.title || htmlSeo.title || "",
      description: metadata.description || htmlSeo.description || "",
      keywords: metadata.keywords || htmlSeo.keywords || "",
      robots: metadata.robots || htmlSeo.robots || "",
      canonical: metadata.canonical || htmlSeo.canonical || "",
      og: {
        title: ogMeta.title || htmlSeo.og.title || "",
        description: ogMeta.description || htmlSeo.og.description || "",
        image: ogMeta.image || htmlSeo.og.image || "",
        url: ogMeta.url || htmlSeo.og.url || "",
        type: ogMeta.type || htmlSeo.og.type || ""
      },
      twitter: {
        card: twitterMeta.card || htmlSeo.twitter.card || "",
        title: twitterMeta.title || htmlSeo.twitter.title || "",
        description: twitterMeta.description || htmlSeo.twitter.description || "",
        image: twitterMeta.image || htmlSeo.twitter.image || ""
      }
    }
  };
}

function createGetSeoHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function getSeoHandler(req, res) {
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
      pathEnvKey: "CRAWL4AI_GETSEO_PATH",
      defaultPath: "/crawl",
      body: {
        ...body,
        urls: targetUrls
      },
      timeoutMessage: "Get SEO request timed out."
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json(upstream.payload);
    }

    const results = normalizeCrawlResults(upstream.payload, hasSeoCandidate);
    if (!results.length) {
      return res.status(502).json({
        status: 502,
        error: "Crawl service response did not include SEO records.",
        details: upstream.payload
      });
    }

    const items = results.map((result, index) => normalizeSeoResult(result, targetUrls[index]));
    return res.status(200).json({
      count: items.length,
      items
    });
  };
}

router.post("/", createGetSeoHandler());

module.exports = router;
module.exports.createGetSeoHandler = createGetSeoHandler;
