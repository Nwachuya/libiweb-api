const test = require("node:test");
const assert = require("node:assert/strict");

const { createMetadataHandler } = require("../src/routes/metadata");

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

test("returns 400 when url and urls are both missing", async () => {
  const handler = createMetadataHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, {})
  });

  const res = createResponseRecorder();
  await handler({ body: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
  );
});

test("returns normalized metadata items from nested crawl response", async () => {
  let capturedBody = "";
  const handler = createMetadataHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_METADATA_PATH: "/crawl" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://crawl.example/crawl");
      capturedBody = options.body;
      return mockJsonResponse(200, [[{
        url: "https://example.com",
        redirected_url: "https://www.example.com",
        success: true,
        status_code: 200,
        metadata: {
          title: "Example Domain",
          description: "Example description"
        }
      }]]);
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { urls: ["https://example.com"] } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.deepEqual(JSON.parse(capturedBody), { urls: ["https://example.com"] });
  assert.deepEqual(res.body.items[0], {
    url: "https://example.com",
    redirected_url: "https://www.example.com",
    success: true,
    status_code: 200,
    metadata: {
      title: "Example Domain",
      description: "Example description"
    }
  });
});

test("returns 502 when response does not contain crawl result records", async () => {
  const handler = createMetadataHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, { success: true })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Crawl service response did not include metadata records.");
});

test("returns 504 on metadata timeout", async () => {
  const abortError = new Error("timeout");
  abortError.name = "AbortError";
  const handler = createMetadataHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_TIMEOUT_MS: "10" },
    fetchImpl: async () => {
      throw abortError;
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, "Metadata request timed out.");
});
