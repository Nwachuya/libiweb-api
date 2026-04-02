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
      },
      "/v2/crawl": {
        post: {
          summary: "Proxy crawl request to Crawl4AI service",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                    },
                    formats: {
                      type: "array",
                      items: { type: "string" },
                      example: ["markdown", "html"]
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Crawl response payload"
            },
            "400": {
              description: "Missing or invalid url field"
            },
            "502": {
              description: "Failed to reach crawl service"
            },
            "504": {
              description: "Crawl request timeout"
            }
          }
        }
      },
      "/map": {
        post: {
          summary: "Return URL map (internal/external) for a target URL via Crawl4AI",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Mapped URLs grouped by internal/external"
            },
            "400": {
              description: "Missing or invalid url field"
            },
            "502": {
              description: "Failed to reach crawl service"
            },
            "504": {
              description: "Map request timeout"
            }
          }
        }
      },
      "/metadata": {
        post: {
          summary: "Return normalized metadata records from Crawl4AI response",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Normalized metadata records"
            },
            "400": {
              description: "Missing or invalid url/urls field"
            },
            "502": {
              description: "Failed to reach crawl service or malformed response"
            },
            "504": {
              description: "Metadata request timeout"
            }
          }
        }
      },
      "/getmedia": {
        post: {
          summary: "Return normalized media assets from Crawl4AI response",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Normalized media records grouped into images/videos/audios"
            },
            "400": {
              description: "Missing or invalid url/urls field"
            },
            "502": {
              description: "Failed to reach crawl service or malformed response"
            },
            "504": {
              description: "Get media request timeout"
            }
          }
        }
      },
      "/v2/metadata": {
        post: {
          summary: "Return normalized metadata records from Crawl4AI response",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Normalized metadata records"
            },
            "400": {
              description: "Missing or invalid url/urls field"
            },
            "502": {
              description: "Failed to reach crawl service or malformed response"
            },
            "504": {
              description: "Metadata request timeout"
            }
          }
        }
      },
      "/v2/getmedia": {
        post: {
          summary: "Return normalized media assets from Crawl4AI response",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
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
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Normalized media records grouped into images/videos/audios"
            },
            "400": {
              description: "Missing or invalid url/urls field"
            },
            "502": {
              description: "Failed to reach crawl service or malformed response"
            },
            "504": {
              description: "Get media request timeout"
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
