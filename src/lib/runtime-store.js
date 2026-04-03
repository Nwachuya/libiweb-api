const webhookRegistry = new Map();
const bulkJobs = new Map();

function ownerKeyFromRequest(req) {
  const apiKey = req && req.headers ? req.headers["x-api-key"] : "";
  const auth = (req && req.auth) || {};
  return String(auth.apiKeyId || apiKey || auth.accountId || "anonymous");
}

module.exports = {
  webhookRegistry,
  bulkJobs,
  ownerKeyFromRequest
};
