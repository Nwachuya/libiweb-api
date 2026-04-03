const express = require("express");
const { isHttpUrl } = require("../lib/crawl4ai");
const { ownerKeyFromRequest, webhookRegistry } = require("../lib/runtime-store");

const router = express.Router();

function createWebhookRegisterHandler() {
  return async function webhookRegisterHandler(req, res) {
    const body = req.body || {};
    const owner = ownerKeyFromRequest(req);
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const secret = typeof body.secret === "string" ? body.secret : "";
    const events = Array.isArray(body.events) && body.events.length
      ? body.events.map((event) => String(event).trim()).filter(Boolean)
      : ["bulk.completed", "bulk.failed"];

    if (!isHttpUrl(url)) {
      return res.status(400).json({
        status: 400,
        error: "Invalid webhook URL. Provide a valid http(s) URL."
      });
    }

    const now = new Date().toISOString();
    const registration = {
      url,
      secret,
      events,
      updated_at: now
    };

    webhookRegistry.set(owner, registration);

    return res.status(200).json({
      owner,
      webhook: {
        url: registration.url,
        events: registration.events,
        updated_at: registration.updated_at
      }
    });
  };
}

router.post("/register", createWebhookRegisterHandler());

module.exports = router;
module.exports.createWebhookRegisterHandler = createWebhookRegisterHandler;
