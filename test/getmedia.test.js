const test = require("node:test");
const assert = require("node:assert/strict");

const { createGetMediaHandler } = require("../src/routes/getmedia");

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
  const handler = createGetMediaHandler({
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

test("returns normalized media grouped by type with deduped counts", async () => {
  let capturedBody = "";
  const handler = createGetMediaHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_GETMEDIA_PATH: ""
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://crawl.example");
      capturedBody = options.body;
      return mockJsonResponse(200, [[{
        url: "https://example.com/listing",
        media: {
          images: [
            { src: "/img/a.jpg", alt: "A", format: "jpg", score: 3 },
            { src: "https://example.com/img/a.jpg#hero", alt: "A duplicate" }
          ],
          videos: [
            { src: "https://cdn.example.com/video.mp4", format: "mp4" }
          ],
          audios: [
            { src: "/audio/intro.mp3", format: "mp3" }
          ]
        }
      }]]);
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { urls: ["https://example.com/listing"] } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(capturedBody), { urls: ["https://example.com/listing"] });
  assert.deepEqual(res.body.counts, {
    total: 3,
    images: 1,
    videos: 1,
    audios: 1
  });
  assert.deepEqual(res.body.images, [{
    src: "https://example.com/img/a.jpg",
    type: "image",
    alt: "A",
    format: "jpg",
    score: 3
  }]);
  assert.deepEqual(res.body.videos, [{
    src: "https://cdn.example.com/video.mp4",
    type: "video",
    format: "mp4"
  }]);
  assert.deepEqual(res.body.audios, [{
    src: "https://example.com/audio/intro.mp3",
    type: "audio",
    format: "mp3"
  }]);
});

test("accepts wrapped Crawl4AI results payload", async () => {
  const handler = createGetMediaHandler({
    env: {
      CRAWL4AI_BASE_URL: "http://crawl.example",
      CRAWL4AI_GETMEDIA_PATH: "/crawl"
    },
    fetchImpl: async () => mockJsonResponse(200, {
      success: true,
      results: [{
        url: "https://example.com/listing",
        media: {
          images: [{ src: "/img/a.jpg" }],
          videos: [],
          audios: []
        }
      }]
    })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com/listing" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.counts, {
    total: 1,
    images: 1,
    videos: 0,
    audios: 0
  });
  assert.deepEqual(res.body.images, [{
    src: "https://example.com/img/a.jpg",
    type: "image"
  }]);
});

test("returns 502 when response does not include media records", async () => {
  const handler = createGetMediaHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example" },
    fetchImpl: async () => mockJsonResponse(200, { success: true, links: {} })
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Crawl service response did not include media records.");
});

test("returns 504 when upstream times out", async () => {
  const abortError = new Error("timeout");
  abortError.name = "AbortError";

  const handler = createGetMediaHandler({
    env: { CRAWL4AI_BASE_URL: "http://crawl.example", CRAWL4AI_TIMEOUT_MS: "10" },
    fetchImpl: async () => {
      throw abortError;
    }
  });

  const res = createResponseRecorder();
  await handler({ body: { url: "https://example.com" } }, res);

  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, "Get media request timed out.");
});
