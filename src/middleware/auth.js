/**
 * Auth middleware — validates x-api-key header against API_KEYS env var.
 *
 * Set API_KEYS in your Coolify environment as a comma-separated list:
 *   API_KEYS=key-abc123,key-xyz456
 *
 * Clients must pass the header:
 *   x-api-key: key-abc123
 */

module.exports = function authMiddleware(req, res, next) {
  const rawKeys = process.env.API_KEYS || "";

  if (!rawKeys) {
    console.warn("WARNING: API_KEYS env variable is not set. All requests are being rejected.");
    return res.status(503).json({
      status: 503,
      error: "API is not configured. Contact the administrator."
    });
  }

  const validKeys = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
  const provided = req.headers["x-api-key"];

  if (!provided) {
    return res.status(401).json({
      status: 401,
      error: "Missing API key. Provide it via the x-api-key header."
    });
  }

  if (!validKeys.includes(provided)) {
    return res.status(403).json({
      status: 403,
      error: "Invalid API key."
    });
  }

  next();
};