const test = require("node:test");
const assert = require("node:assert/strict");

const { createGetMarkdownHandler } = require("../src/routes/getmarkdown");

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
  const handler = createGetMarkdownHandler({
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

test("returns normalized markdown items from nested crawl response", async () => {
  let capturedBody = "";
  const handler = createGetMarkdownHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_GETMARKDOWN_PATH: "/crawl" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://crawl.example/crawl");
      capturedBody = options.body;
      return mockJsonResponse(200, [[{
        url: "https://example.com",
        redirected_url: "https://www.example.com",
        success: true,
        status_code: 200,
        markdown: {
          raw_markdown: "# Example Domain",
          markdown_with_citations: "# Example Domain [1]",
          references_markdown: "## References\n[1] https://example.com"
        }
      }]]);
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { urls: ["https://example.com"] } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.total_characters, "# Example Domain".length);
  assert.deepEqual(JSON.parse(capturedBody), { urls: ["https://example.com"] });
  assert.deepEqual(res.body.items[0], {
    url: "https://example.com",
    redirected_url: "https://www.example.com",
    success: true,
    status_code: 200,
    markdown: "# Example Domain",
    markdown_with_citations: "# Example Domain [1]",
    references_markdown: "## References\n[1] https://example.com"
  });
});

test("falls back to markdown_with_citations when raw_markdown is empty", async () => {
  const handler = createGetMarkdownHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[{
      url: "https://example.com",
      markdown: {
        raw_markdown: "",
        markdown_with_citations: "CITED",
        fit_markdown: "FIT"
      }
    }]])
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items[0].markdown, "CITED");
  assert.equal(res.body.items[0].markdown_with_citations, "CITED");
  assert.equal(res.body.items[0].fit_markdown, "FIT");
});

test("returns 502 when response does not contain crawl markdown records", async () => {
  const handler = createGetMarkdownHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, { success: true, media: {} })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Crawl service response did not include markdown records.");
});

test("returns 504 on get markdown timeout", async () => {
  const abortError = new Error("timeout");
  abortError.name = "AbortError";
  const handler = createGetMarkdownHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_TIMEOUT_MS: "10" },
    fetchImpl: async () => {
      throw abortError;
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, "Get markdown request timed out.");
});
