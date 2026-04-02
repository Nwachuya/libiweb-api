const express = require("express");
const router = express.Router();

// GET /v2/health
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: "v2"
  });
});

module.exports = router;