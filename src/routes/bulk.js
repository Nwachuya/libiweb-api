const crypto = require("crypto");
const express = require("express");
const {
  extractTargetUrls,
  normalizeCrawlResults,
  postToCrawlService
} = require("../lib/crawl4ai");
const {
  bulkJobs,
  ownerKeyFromRequest,
  webhookRegistry
} = require("../lib/runtime-store");

const router = express.Router();

function randomJobId() {
  return `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function hasCrawlRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function summarizeResult(result, fallbackUrl) {
  return {
    url: result.url || result.redirected_url || fallbackUrl || null,
    redirected_url: result.redirected_url || null,
    success: result.success === true,
    status_code: result.status_code ?? null
  };
}

async function deliverWebhook(options) {
  const { fetchImpl, registration, payload } = options;
  if (!registration || !registration.url || typeof fetchImpl !== "function") return;

  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "x-libiweb-event": payload.event || "bulk.completed"
  };

  if (registration.secret) {
    const signature = crypto.createHmac("sha256", registration.secret).update(body).digest("hex");
    headers["x-libiweb-signature"] = signature;
  }

  try {
    await fetchImpl(registration.url, {
      method: "POST",
      headers,
      body
    });
  } catch {
    // Webhook delivery failures are intentionally non-fatal for the job result.
  }
}

function createBulkHandler(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;

  return async function bulkHandler(req, res) {
    const body = req.body || {};
    const targetUrls = extractTargetUrls(body);
    if (!targetUrls.length) {
      return res.status(400).json({
        status: 400,
        error: "Invalid or missing target URLs. Provide 'urls' (or 'url') with valid http(s) values."
      });
    }

    const owner = ownerKeyFromRequest(req);
    const jobId = randomJobId();
    const now = new Date().toISOString();
    const webhook = webhookRegistry.get(owner) || null;

    bulkJobs.set(jobId, {
      id: jobId,
      owner,
      status: "queued",
      created_at: now,
      updated_at: now,
      urls: targetUrls,
      result: null,
      error: null
    });

    setImmediate(async () => {
      const job = bulkJobs.get(jobId);
      if (!job) return;

      job.status = "processing";
      job.updated_at = new Date().toISOString();

      const upstream = await postToCrawlService({
        env,
        fetchImpl,
        pathEnvKey: "CRAWL4AI_BULK_PATH",
        defaultPath: "/crawl",
        body: {
          ...body,
          urls: targetUrls
        },
        timeoutMessage: "Bulk crawl request timed out."
      });

      if (!upstream.ok) {
        job.status = "failed";
        job.error = upstream.payload;
        job.updated_at = new Date().toISOString();
        await deliverWebhook({
          fetchImpl,
          registration: webhook,
          payload: {
            event: "bulk.failed",
            job_id: jobId,
            status: job.status,
            error: job.error
          }
        });
        return;
      }

      const results = normalizeCrawlResults(upstream.payload, hasCrawlRecord);
      const items = results.map((result, index) => summarizeResult(result, targetUrls[index]));
      job.status = "completed";
      job.result = {
        count: items.length,
        items
      };
      job.updated_at = new Date().toISOString();

      await deliverWebhook({
        fetchImpl,
        registration: webhook,
        payload: {
          event: "bulk.completed",
          job_id: jobId,
          status: job.status,
          result: job.result
        }
      });
    });

    return res.status(202).json({
      job_id: jobId,
      status: "queued",
      count: targetUrls.length
    });
  };
}

function createBulkStatusHandler() {
  return async function bulkStatusHandler(req, res) {
    const owner = ownerKeyFromRequest(req);
    const jobId = req.params.jobId;
    const job = bulkJobs.get(jobId);

    if (!job || job.owner !== owner) {
      return res.status(404).json({
        status: 404,
        error: "Bulk job not found."
      });
    }

    return res.status(200).json({
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
      urls: job.urls,
      result: job.result,
      error: job.error
    });
  };
}

router.post("/", createBulkHandler());
router.get("/:jobId", createBulkStatusHandler());

module.exports = router;
module.exports.createBulkHandler = createBulkHandler;
module.exports.createBulkStatusHandler = createBulkStatusHandler;
