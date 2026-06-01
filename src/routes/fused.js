const express = require("express");
const { postToFusedService } = require("../lib/fused");

const router = express.Router();

function createFusedHandler(upstreamPath, options = {}) {
  const { fetchImpl: overrideFetch } = options;

  return async function fusedHandler(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ status: 400, error: "Request body must be a JSON object." });
    }

    const fetchImpl = overrideFetch || global.fetch;
    const upstream = await postToFusedService({
      env: process.env,
      fetchImpl,
      upstreamPath,
      body
    });

    return res.status(upstream.status).json(upstream.payload);
  };
}

// Expose createFusedHandler for testing
router.createFusedHandler = createFusedHandler;

router.post("/chrono",         createFusedHandler("/v1/chrono"));
router.post("/mock",           createFusedHandler("/v1/mock"));
router.post("/fuzzy",          createFusedHandler("/v1/fuzzy"));
router.post("/token",          createFusedHandler("/v1/token"));
router.post("/pack",           createFusedHandler("/v1/pack"));
router.post("/diff",           createFusedHandler("/v1/diff"));
router.post("/cast",           createFusedHandler("/v1/cast"));
router.post("/tax",            createFusedHandler("/v1/tax"));
router.post("/policy",         createFusedHandler("/v1/policy"));
router.post("/telemetry",      createFusedHandler("/v1/telemetry"));
router.post("/series",         createFusedHandler("/v1/series"));
router.post("/spatial",        createFusedHandler("/v1/spatial"));
router.post("/proration",      createFusedHandler("/v1/proration"));
router.post("/apca",           createFusedHandler("/v1/apca"));
router.post("/dag",            createFusedHandler("/v1/dag"));
router.post("/enforcer",       createFusedHandler("/v1/enforcer"));
router.post("/gcode",          createFusedHandler("/v1/gcode"));
router.post("/bio",            createFusedHandler("/v1/bio"));
router.post("/bio/search",     createFusedHandler("/v1/bio/search"));
router.post("/merkle/root",    createFusedHandler("/v1/merkle/root"));
router.post("/merkle/proof",   createFusedHandler("/v1/merkle/proof"));
router.post("/aeo",            createFusedHandler("/v1/aeo"));
router.post("/shifts",         createFusedHandler("/v1/shifts"));

module.exports = router;
