const test = require("node:test");
const assert = require("node:assert/strict");
const { postToFusedService } = require("../src/lib/fused");
const fusedRouter = require("../src/routes/fused");

function mockJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); }
  };
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test("postToFusedService returns 502 when fetch fails", async () => {
  const result = await postToFusedService({
    env: { FUSED_API_BASE_URL: "http://localhost:8001" },
    fetchImpl: async () => { throw new Error("connection refused"); },
    upstreamPath: "/v1/chrono",
    body: {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
});

test("postToFusedService returns 504 on timeout", async () => {
  const result = await postToFusedService({
    env: { FUSED_API_BASE_URL: "http://localhost:8001", FUSED_TIMEOUT_MS: "1" },
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => {}, 100);
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        const err = new Error("AbortError");
        err.name = "AbortError";
        reject(err);
      });
    }),
    upstreamPath: "/v1/chrono",
    body: {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 504);
});

test("postToFusedService passes response through on success", async () => {
  const result = await postToFusedService({
    env: { FUSED_API_BASE_URL: "http://localhost:8001" },
    fetchImpl: async () => mockJsonResponse(200, { intersections: [] }),
    upstreamPath: "/v1/chrono",
    body: { participants: [] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { intersections: [] });
});

test("fused route returns 400 when body is not an object", async () => {
  const handler = fusedRouter.createFusedHandler("/v1/chrono");
  const res = createResponseRecorder();
  await handler({ body: null }, res);
  assert.equal(res.statusCode, 400);
});

test("fused route returns 400 when body is an array", async () => {
  const handler = fusedRouter.createFusedHandler("/v1/mock");
  const res = createResponseRecorder();
  await handler({ body: [] }, res);
  assert.equal(res.statusCode, 400);
});

test("fused route proxies valid body and returns upstream response", async () => {
  const handler = fusedRouter.createFusedHandler("/v1/fuzzy", {
    fetchImpl: async () => mockJsonResponse(200, { clusters: [["a", "a."]] })
  });
  const res = createResponseRecorder();
  await handler({ body: { items: ["a", "a."], threshold: 0.85 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.clusters, [["a", "a."]]);
});

test("fused route passes upstream error status through", async () => {
  const handler = fusedRouter.createFusedHandler("/v1/chrono", {
    fetchImpl: async () => mockJsonResponse(422, { detail: "validation error" })
  });
  const res = createResponseRecorder();
  await handler({ body: { participants: "bad" } }, res);
  assert.equal(res.statusCode, 422);
});
