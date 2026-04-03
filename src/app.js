const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authMiddleware = require("./middleware/auth");
const usageLoggerMiddleware = require("./middleware/usage-logger");
const healthRouter = require("./routes/health");
const statusRouter = require("./routes/status");
const crawlRouter = require("./routes/crawl");
const mapRouter = require("./routes/map");
const metadataRouter = require("./routes/metadata");
const getMediaRouter = require("./routes/getmedia");
const getMarkdownRouter = require("./routes/getmarkdown");
const getHtmlRouter = require("./routes/gethtml");
const getTextRouter = require("./routes/gettext");
const getSeoRouter = require("./routes/getseo");
const extractRouter = require("./routes/extract");
const screenshotRouter = require("./routes/screenshot");
const getEmailsRouter = require("./routes/getemails");
const bulkRouter = require("./routes/bulk");
const usageRouter = require("./routes/usage");
const webhookRouter = require("./routes/webhook");
const pagesRouter = require("./routes/pages");
const swaggerRoute = require("../pages/swagger");

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));

// Parse JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Too many requests. Please slow down."
  }
});
app.use(limiter);

// Public API metadata
app.get("/api", (req, res) => {
  res.json({
    name: "libiweb API",
    version: "v2",
    docs: "/swagger.json",
    status: "online"
  });
});

// Public OpenAPI document
app.get("/swagger.json", swaggerRoute);

// Public informational pages
app.use("/", pagesRouter);

// All /v2/* routes require a valid API key
app.use("/v2", authMiddleware);
app.use("/v2", usageLoggerMiddleware);

// Mount route modules
app.use("/v2/health", healthRouter);
app.use("/v2/status", statusRouter);
app.use("/v2/crawl", crawlRouter);
app.use("/v2/map", mapRouter);
app.use("/v2/metadata", metadataRouter);
app.use("/v2/getmedia", getMediaRouter);
app.use("/v2/getmarkdown", getMarkdownRouter);
app.use("/v2/gethtml", getHtmlRouter);
app.use("/v2/gettext", getTextRouter);
app.use("/v2/getseo", getSeoRouter);
app.use("/v2/getemails", getEmailsRouter);
app.use("/v2/extract", extractRouter);
app.use("/v2/screenshot", screenshotRouter);
app.use("/v2/bulk", bulkRouter);
app.use("/v2/usage", usageRouter);
app.use("/v2/webhook", webhookRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: "Endpoint not found"
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 500,
    error: "Internal server error"
  });
});

module.exports = app;
