const test = require("node:test");
const assert = require("node:assert/strict");

const ORIGINAL_FETCH = global.fetch;
const ENV_KEYS = [
  "API_KEYS",
  "PB_URL",
  "PB_ADMIN_EMAIL",
  "PB_ADMIN_PASSWORD",
  "PB_COLLECTION_USERS",
  "PB_COLLECTION_ACCOUNT",
  "PB_COLLECTION_API_KEYS",
  "PB_COLLECTION_PLANS",
  "PB_COLLECTION_USAGE_LOGS",
  "PB_REQUIRE_VERIFIED_USER",
  "PB_ALLOWED_API_KEY_STATUS",
  "PB_ALLOWED_SUB_STATUSES",
  "PB_FAIL_CLOSED",
  "PB_ENFORCE_ENDPOINT_ALLOWLIST",
  "PB_ENFORCE_MONTHLY_CREDITS",
  "PB_CREDIT_CHECK_EXEMPT_ENDPOINTS"
];

function clearSrcCache() {
  for (const id of Object.keys(require.cache)) {
    if (id.includes("/src/")) delete require.cache[id];
  }
}

function loadAuth(env, fetchImpl) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  global.fetch = fetchImpl || ORIGINAL_FETCH;
  clearSrcCache();
  return require("../src/middleware/auth");
}

function mockJson(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

function runMiddleware(middleware, req = {}) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        resolved = true;
        resolve({ type: "response", status: this.statusCode, body });
      }
    };

    const next = () => {
      resolved = true;
      resolve({ type: "next", req });
    };

    Promise.resolve(middleware(req, res, next))
      .then(() => {
        if (!resolved) {
          resolve({ type: "none", req });
        }
      })
      .catch(reject);
  });
}

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  clearSrcCache();
});

test("returns 401 when x-api-key header is missing", async () => {
  const auth = loadAuth({ API_KEYS: "test-key" });
  const result = await runMiddleware(auth, { headers: {} });
  assert.equal(result.type, "response");
  assert.equal(result.status, 401);
});

test("allows request with valid static API key", async () => {
  const auth = loadAuth({ API_KEYS: "test-key" });
  const req = { headers: { "x-api-key": "test-key" } };
  const result = await runMiddleware(auth, req);
  assert.equal(result.type, "next");
});

test("rejects request with invalid static API key", async () => {
  const auth = loadAuth({ API_KEYS: "test-key" });
  const req = { headers: { "x-api-key": "bad-key" } };
  const result = await runMiddleware(auth, req);
  assert.equal(result.type, "response");
  assert.equal(result.status, 403);
});

test("validates active PocketBase API key and calls next", async () => {
  const fetchMock = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/admins/auth-with-password") {
      return mockJson(200, { token: "pb-token" });
    }
    if (pathname === "/api/collections/api_keys/records") {
      return mockJson(200, {
        items: [{ id: "k1", key: "pb-key", status: "active", expires: false, account: "acc1" }]
      });
    }
    if (pathname === "/api/collections/account/records/acc1") {
      return mockJson(200, { id: "acc1", user: "usr1", role: "user", stripe_sub_status: "active" });
    }
    if (pathname === "/api/collections/users/records/usr1") {
      return mockJson(200, { id: "usr1", verified: true });
    }
    return mockJson(404, { error: "Unexpected path" });
  };

  const auth = loadAuth(
    {
      PB_URL: "https://pb.example.com",
      PB_ADMIN_EMAIL: "admin@example.com",
      PB_ADMIN_PASSWORD: "secret",
      PB_ALLOWED_API_KEY_STATUS: "active",
      PB_ALLOWED_SUB_STATUSES: "active,trialing",
      PB_REQUIRE_VERIFIED_USER: "true",
      PB_FAIL_CLOSED: "true"
    },
    fetchMock
  );

  const req = { headers: { "x-api-key": "pb-key" } };
  const result = await runMiddleware(auth, req);
  assert.equal(result.type, "next");
  assert.equal(req.auth.accountId, "acc1");
  assert.equal(req.auth.userId, "usr1");
});

test("rejects inactive PocketBase API key", async () => {
  const fetchMock = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/admins/auth-with-password") {
      return mockJson(200, { token: "pb-token" });
    }
    if (pathname === "/api/collections/api_keys/records") {
      return mockJson(200, {
        items: [{ id: "k1", key: "pb-key", status: "inactive", expires: false, account: "acc1" }]
      });
    }
    return mockJson(404, { error: "Unexpected path" });
  };

  const auth = loadAuth(
    {
      PB_URL: "https://pb.example.com",
      PB_ADMIN_EMAIL: "admin@example.com",
      PB_ADMIN_PASSWORD: "secret",
      PB_ALLOWED_API_KEY_STATUS: "active",
      PB_FAIL_CLOSED: "true"
    },
    fetchMock
  );

  const result = await runMiddleware(auth, { headers: { "x-api-key": "pb-key" } });
  assert.equal(result.type, "response");
  assert.equal(result.status, 403);
  assert.equal(result.body.error, "API key is inactive.");
});

test("rejects when endpoint is not allowed for API key", async () => {
  const fetchMock = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/admins/auth-with-password") {
      return mockJson(200, { token: "pb-token" });
    }
    if (pathname === "/api/collections/api_keys/records") {
      return mockJson(200, {
        items: [{
          id: "k1",
          key: "pb-key",
          status: "active",
          expires: false,
          account: "acc1",
          allowed_endpoints_override: ["/v2/metadata"]
        }]
      });
    }
    if (pathname === "/api/collections/account/records/acc1") {
      return mockJson(200, { id: "acc1", user: "usr1", role: "user", stripe_sub_status: "active" });
    }
    if (pathname === "/api/collections/users/records/usr1") {
      return mockJson(200, { id: "usr1", verified: true });
    }
    return mockJson(404, { error: "Unexpected path" });
  };

  const auth = loadAuth(
    {
      PB_URL: "https://pb.example.com",
      PB_ADMIN_EMAIL: "admin@example.com",
      PB_ADMIN_PASSWORD: "secret",
      PB_ALLOWED_API_KEY_STATUS: "active",
      PB_FAIL_CLOSED: "true",
      PB_ENFORCE_ENDPOINT_ALLOWLIST: "true",
      PB_ENFORCE_MONTHLY_CREDITS: "false"
    },
    fetchMock
  );

  const result = await runMiddleware(auth, {
    headers: { "x-api-key": "pb-key" },
    originalUrl: "/v2/crawl",
    method: "POST"
  });

  assert.equal(result.type, "response");
  assert.equal(result.status, 403);
  assert.match(result.body.error, /Endpoint not allowed/);
});

test("rejects when monthly credit limit is exceeded", async () => {
  const fetchMock = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/api/admins/auth-with-password") {
      return mockJson(200, { token: "pb-token" });
    }
    if (pathname === "/api/collections/api_keys/records") {
      return mockJson(200, {
        items: [{
          id: "k1",
          key: "pb-key",
          status: "active",
          expires: false,
          account: "acc1",
          monthly_credits_override: 2
        }]
      });
    }
    if (pathname === "/api/collections/account/records/acc1") {
      return mockJson(200, { id: "acc1", user: "usr1", role: "user", stripe_sub_status: "active" });
    }
    if (pathname === "/api/collections/usage_logs/records") {
      return mockJson(200, {
        items: [{ credit_used: 1 }, { credit_used: 1 }],
        totalPages: 1
      });
    }
    if (pathname === "/api/collections/users/records/usr1") {
      return mockJson(200, { id: "usr1", verified: true });
    }
    return mockJson(404, { error: "Unexpected path" });
  };

  const auth = loadAuth(
    {
      PB_URL: "https://pb.example.com",
      PB_ADMIN_EMAIL: "admin@example.com",
      PB_ADMIN_PASSWORD: "secret",
      PB_ALLOWED_API_KEY_STATUS: "active",
      PB_FAIL_CLOSED: "true",
      PB_ENFORCE_MONTHLY_CREDITS: "true",
      PB_ENFORCE_ENDPOINT_ALLOWLIST: "false"
    },
    fetchMock
  );

  const result = await runMiddleware(auth, {
    headers: { "x-api-key": "pb-key" },
    originalUrl: "/v2/crawl",
    method: "POST"
  });

  assert.equal(result.type, "response");
  assert.equal(result.status, 429);
  assert.equal(result.body.error, "Monthly credit limit exceeded.");
});
