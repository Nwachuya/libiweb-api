module.exports = function swaggerRoute(req, res) {
  const targetUrlsSchema = {
    type: "object",
    description: "Provide either url (single target) or urls (array of targets).",
    properties: {
      url: {
        type: "string",
        format: "uri",
        example: "https://example.com"
      },
      urls: {
        type: "array",
        items: { type: "string", format: "uri" },
        example: ["https://example.com"]
      }
    }
  };

  const crawlRequestSchema = {
    ...targetUrlsSchema,
    properties: {
      ...targetUrlsSchema.properties,
      formats: {
        type: "array",
        items: { type: "string" },
        example: ["markdown", "html"]
      }
    }
  };

  const extractRequestSchema = {
    ...targetUrlsSchema,
    properties: {
      ...targetUrlsSchema.properties,
      fields: {
        type: "array",
        items: {
          type: "string",
          enum: ["emails", "phones", "urls"]
        },
        example: ["emails", "phones", "urls"]
      }
    }
  };

  const bulkRequestSchema = {
    ...targetUrlsSchema,
    properties: {
      ...targetUrlsSchema.properties
    },
    required: ["urls"]
  };

  const webhookRequestSchema = {
    type: "object",
    required: ["url"],
    properties: {
      url: {
        type: "string",
        format: "uri",
        example: "https://hooks.example.com/libiweb"
      },
      secret: {
        type: "string",
        example: "optional-shared-secret"
      },
      events: {
        type: "array",
        items: {
          type: "string",
          enum: ["bulk.completed", "bulk.failed"]
        },
        example: ["bulk.completed"]
      }
    }
  };

  const commonAuthErrors = {
    "401": { description: "Missing API key" },
    "403": { description: "Invalid API key" }
  };

  const jsonBody = (schema) => ({
    required: true,
    content: {
      "application/json": {
        schema
      }
    }
  });

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
      "/api": {
        get: {
          summary: "Public service metadata",
          responses: {
            "200": { description: "Service metadata" }
          }
        }
      },
      "/swagger.json": {
        get: {
          summary: "OpenAPI document",
          responses: {
            "200": { description: "OpenAPI specification" }
          }
        }
      },
      "/v2/health": {
        get: {
          summary: "Health check endpoint",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            ...commonAuthErrors,
            "200": { description: "Service health details" }
          }
        }
      },
      "/v2/status": {
        get: {
          summary: "Runtime status endpoint",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            ...commonAuthErrors,
            "200": { description: "Service runtime status" }
          }
        }
      },
      "/v2/crawl": {
        post: {
          summary: "Run crawl for one or more target URLs",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(crawlRequestSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Crawl response payload" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Failed to reach extraction backend" },
            "504": { description: "Crawl request timeout" }
          }
        }
      },
      "/v2/map": {
        post: {
          summary: "Return URL map grouped by internal and external links",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Mapped URLs grouped by internal/external" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Map request timeout" }
          }
        }
      },
      "/v2/metadata": {
        post: {
          summary: "Return normalized metadata records",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized metadata records" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Metadata request timeout" }
          }
        }
      },
      "/v2/getmedia": {
        post: {
          summary: "Return normalized media assets",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized media grouped into images/videos/audios" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Get media request timeout" }
          }
        }
      },
      "/v2/getmarkdown": {
        post: {
          summary: "Return normalized markdown output",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized markdown records" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Get markdown request timeout" }
          }
        }
      },
      "/v2/gethtml": {
        post: {
          summary: "Return normalized HTML output",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized HTML records" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Get HTML request timeout" }
          }
        }
      },
      "/v2/gettext": {
        post: {
          summary: "Return plain text extraction",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized text records" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Get text request timeout" }
          }
        }
      },
      "/v2/getseo": {
        post: {
          summary: "Return SEO-focused extraction",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Normalized SEO records" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Get SEO request timeout" }
          }
        }
      },
      "/v2/getemails": {
        post: {
          summary: "Discover emails from target and linked pages",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Discovered email list with source URLs" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Email discovery timeout" }
          }
        }
      },
      "/v2/extract": {
        post: {
          summary: "Run built-in field extraction",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(extractRequestSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Extracted values by requested fields" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Extraction request timeout" }
          }
        }
      },
      "/v2/screenshot": {
        post: {
          summary: "Return screenshot extraction records",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(targetUrlsSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Screenshot extraction results" },
            "400": { description: "Missing or invalid url/urls field" },
            "502": { description: "Malformed extraction response" },
            "504": { description: "Screenshot request timeout" }
          }
        }
      },
      "/v2/bulk": {
        post: {
          summary: "Queue a bulk extraction job",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(bulkRequestSchema),
          responses: {
            ...commonAuthErrors,
            "202": { description: "Bulk job queued" },
            "400": { description: "Missing or invalid urls field" }
          }
        }
      },
      "/v2/bulk/{jobId}": {
        get: {
          summary: "Get bulk job status and result",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "jobId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            ...commonAuthErrors,
            "200": { description: "Bulk job status payload" },
            "404": { description: "Bulk job not found" }
          }
        }
      },
      "/v2/usage": {
        get: {
          summary: "Get usage analytics",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "period",
              in: "query",
              required: false,
              schema: { type: "string", example: "2026-04" },
              description: "Month in YYYY-MM format. Defaults to current month (UTC)."
            },
            {
              name: "scope",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["key", "account"], default: "key" },
              description: "Aggregation scope."
            }
          ],
          responses: {
            ...commonAuthErrors,
            "200": { description: "Usage summary payload" },
            "400": { description: "Invalid period or scope parameters" },
            "502": { description: "Failed to load usage data" },
            "503": { description: "Usage service not configured" }
          }
        }
      },
      "/v2/webhook/register": {
        post: {
          summary: "Register webhook callback for bulk jobs",
          security: [{ ApiKeyAuth: [] }],
          requestBody: jsonBody(webhookRequestSchema),
          responses: {
            ...commonAuthErrors,
            "200": { description: "Webhook registration saved" },
            "400": { description: "Invalid webhook URL" }
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
