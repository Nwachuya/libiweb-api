const test = require("node:test");
const assert = require("node:assert/strict");

const { createCrawlHandler } = require("../src/routes/crawl");

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function mockJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("returns 400 when url is missing", async () => {
  const handler = createCrawlHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, {})
  });

  const req = { body: {} };
  const res = createResponseRecorder();

  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
  );
});

test("returns 200 and passthrough payload when upstream succeeds", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  const handler = createCrawlHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_PATH: ""
    },
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedBody = options.body;
      return mockJsonResponse(200, { markdown: "content" });
    }
  });

  const req = { body: { url: "https://example.com", formats: ["markdown"] } };
  const res = createResponseRecorder();

  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(capturedUrl, "http://crawl.example");
  assert.deepEqual(JSON.parse(capturedBody), {
    url: "https://example.com",
    urls: ["https://example.com"],
    formats: ["markdown"]
  });
  assert.deepEqual(res.body, { markdown: "content" });
});

test("accepts urls array request body format", async () => {
  let capturedBody = "";
  const handler = createCrawlHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_PATH: ""
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://crawl.example");
      capturedBody = options.body;
      return mockJsonResponse(200, { success: true });
    }
  });

  const req = { body: { urls: ["https://example.com"] } };
  const res = createResponseRecorder();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(capturedBody), { urls: ["https://example.com"] });
});

test("returns upstream error details when crawl service fails", async () => {
  const handler = createCrawlHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(502, { message: "upstream error" })
  });

  const req = { body: { url: "https://example.com" } };
  const res = createResponseRecorder();

  await handler(req, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Crawl service returned an error.");
  assert.deepEqual(res.body.details, { message: "upstream error" });
});

test("returns 504 when crawl request times out", async () => {
  const abortError = new Error("timed out");
  abortError.name = "AbortError";

  const handler = createCrawlHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_TIMEOUT_MS: "25" },
    fetchImpl: async () => {
      throw abortError;
    }
  });

  const req = { body: { url: "https://example.com" } };
  const res = createResponseRecorder();

  await handler(req, res);
  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, "Crawl request timed out.");
});
