const test = require("node:test");
const assert = require("node:assert/strict");

const { createMapHandler } = require("../src/routes/map");

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

test("returns 400 for invalid target url", async () => {
  const handler = createMapHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, {})
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "not-a-url" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    "Invalid or missing target URL. Provide 'url' or 'urls' with valid http(s) values."
  );
});

test("returns mapped urls grouped by internal and external", async () => {
  let capturedBody = "";
  const handler = createMapHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_MAP_PATH: ""
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://crawl.example");
      capturedBody = options.body;
      return mockJsonResponse(200, [[{
        url: "https://example.com",
        links: {
          internal: [{ href: "https://example.com/a" }, { href: "https://blog.example.com/b" }],
          external: [{ href: "https://other.com/x" }, { href: "https://another.net/z" }]
        }
      }]]);
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { urls: ["https://example.com"] } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.counts.total, 4);
  assert.deepEqual(res.body.internal, ["https://blog.example.com/b", "https://example.com/a"]);
  assert.deepEqual(res.body.external, [
    "https://another.net/z",
    "https://other.com/x"
  ]);
  assert.deepEqual(JSON.parse(capturedBody), { urls: ["https://example.com"] });
});

test("accepts wrapped Crawl4AI results payload", async () => {
  const handler = createMapHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_MAP_PATH: "/crawl"
    },
    fetchImpl: async () =>
      mockJsonResponse(200, {
        success: true,
        results: [{
          url: "https://example.com",
          links: {
            internal: [{ href: "https://example.com/a" }],
            external: [{ href: "https://other.com/x" }]
          }
        }]
      })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.counts, { total: 2, internal: 1, external: 1 });
  assert.deepEqual(res.body.internal, ["https://example.com/a"]);
  assert.deepEqual(res.body.external, ["https://other.com/x"]);
});

test("returns 502 when response does not include Crawl4AI link maps", async () => {
  const handler = createMapHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_MAP_PATH: "/crawl"
    },
    fetchImpl: async () => mockJsonResponse(200, { success: true, markdown: "no links section" })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Crawl service response did not include link maps.");
});

test("deduplicates overlaps and normalized urls before counting", async () => {
  const handler = createMapHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_MAP_PATH: "/crawl"
    },
    fetchImpl: async () =>
      mockJsonResponse(200, [[{
        url: "https://example.com",
        links: {
          internal: [
            { href: "https://example.com/page/" },
            { href: "https://example.com/page#section" }
          ],
          external: [
            { href: "https://example.com/page" }, // overlap after normalization
            { href: "https://other.com/x/" },
            { href: "https://other.com/x#y" }
          ]
        }
      }]])
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.internal, ["https://example.com/page"]);
  assert.deepEqual(res.body.external, ["https://other.com/x"]);
  assert.deepEqual(res.body.counts, { total: 2, internal: 1, external: 1 });
  assert.deepEqual(res.body.all, ["https://example.com/page", "https://other.com/x"]);
});

test("returns 504 when upstream times out", async () => {
  const abortError = new Error("timeout");
  abortError.name = "AbortError";

  const handler = createMapHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_TIMEOUT_MS: "10" },
    fetchImpl: async () => {
      throw abortError;
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 504);
});
