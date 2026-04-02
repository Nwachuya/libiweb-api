const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const viewsDir = path.join(__dirname, "../../config/views");
const layoutTemplate = fs.readFileSync(path.join(viewsDir, "layout.html"), "utf8");

const pageConfig = {
  home: {
    file: "home.html",
    title: "LibiWeb API - Modern API Infrastructure for Fast Web Apps",
    description: "Build secure, scalable, and fast web experiences with LibiWeb API. Explore documentation, status, and production-ready endpoints.",
    keywords: "LibiWeb API, web API, developer API, REST API, API security, scalable backend, API infrastructure",
    robots: "index, follow, max-image-preview:large",
    canonical: "https://api.libiweb.com/",
    ogTitle: "The API layer for modern web experiences.",
    ogDescription: "Developer-first API infrastructure designed for security, speed, and global scale.",
    nav: ""
  },
  docs: {
    file: "docs.html",
    title: "Documentation - LibiWeb API",
    description: "LibiWeb API docs with authentication, endpoints, and quick start examples.",
    keywords: "LibiWeb API docs, API documentation, health endpoint, status endpoint",
    robots: "index, follow",
    canonical: "https://api.libiweb.com/docs",
    ogTitle: "LibiWeb API Documentation",
    ogDescription: "Authentication and endpoint reference for LibiWeb API v2.",
    nav: "docs"
  },
  privacy: {
    file: "privacy.html",
    title: "Privacy Policy - LibiWeb API",
    description: "Privacy policy for LibiWeb API, including data processing and retention principles.",
    keywords: "LibiWeb privacy, API privacy policy, API data processing",
    robots: "index, follow",
    canonical: "https://api.libiweb.com/privacy",
    ogTitle: "LibiWeb API Privacy Policy",
    ogDescription: "How LibiWeb API processes and retains operational data.",
    nav: ""
  },
  security: {
    file: "security.html",
    title: "Security - LibiWeb API",
    description: "Security overview for LibiWeb API including authentication and abuse protection controls.",
    keywords: "LibiWeb security, API security, authentication, rate limiting",
    robots: "index, follow",
    canonical: "https://api.libiweb.com/security",
    ogTitle: "LibiWeb API Security",
    ogDescription: "Authentication, rate limiting, and secure API operations.",
    nav: ""
  },
  terms: {
    file: "terms.html",
    title: "Terms of Service - LibiWeb API",
    description: "Terms of service for using LibiWeb API endpoints and infrastructure.",
    keywords: "LibiWeb terms, API terms of service, API usage policy",
    robots: "index, follow",
    canonical: "https://api.libiweb.com/terms",
    ogTitle: "LibiWeb API Terms of Service",
    ogDescription: "Terms and conditions for using LibiWeb API.",
    nav: ""
  },
  status: {
    file: "status.html",
    title: "Status - LibiWeb API",
    description: "Current service status page for LibiWeb API and links to machine-readable health endpoints.",
    keywords: "LibiWeb API status, health check, uptime status",
    robots: "index, follow",
    canonical: "https://api.libiweb.com/status",
    ogTitle: "LibiWeb API Status",
    ogDescription: "Live status and health endpoints for LibiWeb API.",
    nav: "status"
  }
};

const pageFragments = Object.fromEntries(
  Object.entries(pageConfig).map(([key, config]) => [
    key,
    fs.readFileSync(path.join(viewsDir, config.file), "utf8")
  ])
);

function fillTokens(template, values) {
  return Object.entries(values).reduce((acc, [token, value]) => {
    return acc.split(`{{${token}}}`).join(value);
  }, template);
}

function renderPage(pageKey) {
  return (req, res, next) => {
    try {
      const config = pageConfig[pageKey];
      const content = pageFragments[pageKey];
      const year = String(new Date().getFullYear());
      const headExtra = pageKey === "home"
        ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"LibiWeb API","url":"https://api.libiweb.com/","description":"Developer-first API infrastructure for secure and scalable web applications."}</script>`
        : "";

      const html = fillTokens(layoutTemplate, {
        TITLE: config.title,
        DESCRIPTION: config.description,
        KEYWORDS: config.keywords,
        ROBOTS: config.robots,
        CANONICAL: config.canonical,
        OG_TITLE: config.ogTitle,
        OG_DESCRIPTION: config.ogDescription,
        HEAD_EXTRA: headExtra,
        NAV_DOCS_ATTR: config.nav === "docs" ? ' aria-current="page"' : "",
        NAV_STATUS_ATTR: config.nav === "status" ? ' aria-current="page"' : "",
        CONTENT: content,
        YEAR: year
      });

      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  };
}

router.get("/", renderPage("home"));
router.get("/home", (req, res) => res.redirect(301, "/"));
router.get("/docs", renderPage("docs"));
router.get("/privacy", renderPage("privacy"));
router.get("/security", renderPage("security"));
router.get("/terms", renderPage("terms"));
router.get("/status", renderPage("status"));

module.exports = router;
