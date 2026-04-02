const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authMiddleware = require("./middleware/auth");
const healthRouter = require("./routes/health");
const statusRouter = require("./routes/status");
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

// Mount route modules
app.use("/v2/health", healthRouter);
app.use("/v2/status", statusRouter);

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
