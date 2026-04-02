const express = require("express");
const router = express.Router();

// GET /v2/status
router.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "libiweb-api",
    version: "v2",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
