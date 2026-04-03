const test = require("node:test");
const assert = require("node:assert/strict");

const { createGetHtmlHandler } = require("../src/routes/gethtml");
const { createGetTextHandler } = require("../src/routes/gettext");
const { createGetSeoHandler } = require("../src/routes/getseo");
const { createExtractHandler } = require("../src/routes/extract");
const { createScreenshotHandler } = require("../src/routes/screenshot");
const { createGetEmailsHandler } = require("../src/routes/getemails");
const { createBulkHandler, createBulkStatusHandler } = require("../src/routes/bulk");
const { createUsageHandler } = require("../src/routes/usage");
const { createWebhookRegisterHandler } = require("../src/routes/webhook");
const { bulkJobs, webhookRegistry } = require("../src/lib/runtime-store");

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
    },
    async json() {
      return body;
    }
  };
}

test("gethtml returns normalized html content", async () => {
  const handler = createGetHtmlHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, {
      success: true,
      results: [{
        url: "https://example.com",
        html: "<html><body>Hello</body></html>",
        status_code: 200,
        success: true
      }]
    })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.items[0].html, "<html><body>Hello</body></html>");
});

test("gettext returns cleaned text", async () => {
  const handler = createGetTextHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[{
      url: "https://example.com",
      markdown: { raw_markdown: "# Header\nThis is a [link](https://example.com)." }
    }]])
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body.items[0].text, /Header/);
  assert.match(res.body.items[0].text, /This is a/);
});

test("getseo returns merged seo fields", async () => {
  const handler = createGetSeoHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[{
      url: "https://example.com",
      metadata: {
        title: "Meta Title",
        description: "Meta Desc"
      },
      html: "<html><head><meta name='robots' content='index,follow'></head></html>"
    }]])
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items[0].seo.title, "Meta Title");
  assert.equal(res.body.items[0].seo.description, "Meta Desc");
  assert.equal(res.body.items[0].seo.robots, "index,follow");
});

test("extract uses built-in extractors only (no user regex required)", async () => {
  const handler = createExtractHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[{
      url: "https://example.com",
      markdown: { raw_markdown: "Email: team@example.com\nPhone: +1 415 555 0123\nVisit https://example.com/about" }
    }]])
  });

  const res = createResponseRecorder();
  await handler({
    body: {
      url: "https://example.com",
      schema: { ignored: "(.*)" },
      regex: "(.*)",
      fields: ["emails", "phones", "urls"]
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.fields, ["emails", "phones", "urls"]);
  assert.deepEqual(res.body.items[0].extracted.emails, ["team@example.com"]);
  assert.deepEqual(res.body.items[0].extracted.phones, ["+1 415 555 0123"]);
  assert.deepEqual(res.body.items[0].extracted.urls, ["https://example.com/about"]);
});

test("screenshot returns screenshot payload", async () => {
  const handler = createScreenshotHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[{
      url: "https://example.com",
      screenshot_url: "https://cdn.example.com/shot.png"
    }]])
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items[0].screenshot.url, "https://cdn.example.com/shot.png");
});

test("getemails scans candidate pages and dedupes emails", async () => {
  let calls = 0;
  const handler = createGetEmailsHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return mockJsonResponse(200, [[{
          url: "https://example.com",
          links: {
            internal: [
              { href: "https://example.com/contact", text: "Contact" },
              { href: "https://example.com/about", text: "About us" },
              { href: "https://example.com/blog", text: "Blog" }
            ]
          }
        }]]);
      }

      return mockJsonResponse(200, [[
        {
          url: "https://example.com/contact",
          markdown: { raw_markdown: "Email us: hello@example.com or sales [at] example [dot] com or mailto:ops@example.com" }
        },
        {
          url: "https://example.com/about",
          markdown: { raw_markdown: "Reach team@example.com" }
        }
      ]]);
    }
  });

  const res = createResponseRecorder();
  await handler({
    body: {
      url: "https://example.com",
      max_pages: 5,
      schema: { email: "(.*)" },
      regex: "(.*)"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.counts.pages_scanned, 3);
  assert.deepEqual(
    res.body.emails.map((item) => item.email),
    ["hello@example.com", "ops@example.com", "sales@example.com", "team@example.com"]
  );
});

test("bulk creates job and status endpoint returns completion", async () => {
  bulkJobs.clear();
  webhookRegistry.clear();

  const bulkHandler = createBulkHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, [[
      { url: "https://example.com/a", success: true, status_code: 200 },
      { url: "https://example.com/b", success: false, status_code: 500 }
    ]])
  });
  const statusHandler = createBulkStatusHandler();

  const bulkRes = createResponseRecorder();
  const reqHeaders = { "x-api-key": "k-test" };
  await bulkHandler({ body: { urls: ["https://example.com/a", "https://example.com/b"] }, headers: reqHeaders }, bulkRes);

  assert.equal(bulkRes.statusCode, 202);
  const jobId = bulkRes.body.job_id;
  assert.ok(jobId);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const statusRes = createResponseRecorder();
  await statusHandler({ params: { jobId }, headers: reqHeaders }, statusRes);

  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusRes.body.status, "completed");
  assert.equal(statusRes.body.result.count, 2);
});

test("usage aggregates usage_logs from PocketBase", async () => {
  let authCalled = false;
  let listCalled = false;
  const handler = createUsageHandler({
    env: {
      PB_URL: "http://pb.example",
      PB_ADMIN_EMAIL: "admin@example.com",
      PB_ADMIN_PASSWORD: "secret",
      PB_COLLECTION_USAGE_LOGS: "usage_logs"
    },
    fetchImpl: async (url) => {
      if (url.includes("/auth-with-password")) {
        authCalled = true;
        return mockJsonResponse(200, { token: "pb-token" });
      }
      listCalled = true;
      return mockJsonResponse(200, {
        items: [
          { endpoint: "/gethtml", credit_used: 2, response_code: "200" },
          { endpoint: "/gethtml", credit_used: 2, response_code: "200" },
          { endpoint: "/getseo", credit_used: 1, response_code: "429" }
        ],
        totalPages: 1
      });
    }
  });

  const res = createResponseRecorder();
  await handler({
    query: { period: "2026-04" },
    headers: { "x-api-key": "k-usage" },
    auth: { accountId: "acc_1" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(authCalled, true);
  assert.equal(listCalled, true);
  assert.equal(res.body.total_requests, 3);
  assert.equal(res.body.total_credits, 5);
});

test("webhook register stores callback configuration", async () => {
  bulkJobs.clear();
  webhookRegistry.clear();

  const handler = createWebhookRegisterHandler();
  const res = createResponseRecorder();
  await handler({
    body: {
      url: "https://hooks.example.com/libiweb",
      secret: "abc123",
      events: ["bulk.completed"]
    },
    headers: { "x-api-key": "k-hook" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.webhook.url, "https://hooks.example.com/libiweb");
  assert.deepEqual(res.body.webhook.events, ["bulk.completed"]);
});
