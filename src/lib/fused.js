const DEFAULT_FUSED_BASE_URL = "http://localhost:8001";
const DEFAULT_TIMEOUT_MS = 30000;

function parseTimeout(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parsePayload(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText.slice(0, 8000) };
  }
}

async function postToFusedService(options) {
  const {
    env,
    fetchImpl,
    upstreamPath,
    body,
    timeoutMessage = "Fused service request timed out."
  } = options;

  if (typeof fetchImpl !== "function") {
    return { ok: false, status: 500, payload: { status: 500, error: "Fetch API is unavailable." } };
  }

  const baseUrl = ((env && env.FUSED_API_BASE_URL) || DEFAULT_FUSED_BASE_URL).trim().replace(/\/+$/, "");
  const timeoutMs = parseTimeout(env && env.FUSED_TIMEOUT_MS);
  const url = `${baseUrl}${upstreamPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let upstream;
  try {
    upstream = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err && err.name === "AbortError") {
      return { ok: false, status: 504, payload: { status: 504, error: timeoutMessage } };
    }
    return { ok: false, status: 502, payload: { status: 502, error: "Unable to reach fused service." } };
  }

  clearTimeout(timeout);
  const raw = await upstream.text();
  const payload = parsePayload(raw);

  return { ok: upstream.ok, status: upstream.status, payload };
}

module.exports = { postToFusedService };
