module.exports = function swaggerRoute(req, res) {
  res.status(200).json({
    openapi: "3.0.3",
    info: {
      title: "libiweb API",
      version: "2.0.0",
      description: "Public API specification for libiweb v2."
    },
    servers: [
      { url: "https://api.libiweb.com" }
    ],
    paths: {
      "/v2/health": {
        get: {
          summary: "Health check endpoint",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": {
              description: "Service health details"
            },
            "401": {
              description: "Missing API key"
            },
            "403": {
              description: "Invalid API key"
            }
          }
        }
      },
      "/v2/status": {
        get: {
          summary: "Runtime status endpoint",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": {
              description: "Service runtime status"
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key"
        }
      }
    }
  });
};
