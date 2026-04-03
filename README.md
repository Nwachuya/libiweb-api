# libiweb API v2

Base URL: `https://api.libiweb.com`

## Authentication

All `/v2/*` endpoints require an API key header:

```http
x-api-key: your-api-key
```

## Public Endpoints

- `GET /api` - service metadata
- `GET /swagger.json` - OpenAPI spec

## v2 Endpoints

- `GET /v2/health`
- `GET /v2/status`
- `POST /v2/crawl`
- `POST /v2/map`
- `POST /v2/metadata`
- `POST /v2/getmedia`
- `POST /v2/getmarkdown`
- `POST /v2/gethtml`
- `POST /v2/gettext`
- `POST /v2/getseo`
- `POST /v2/getemails`
- `POST /v2/extract`
- `POST /v2/screenshot`
- `POST /v2/bulk`
- `GET /v2/bulk/:jobId`
- `GET /v2/usage`
- `POST /v2/webhook/register`

## Quick Start

```bash
npm install
API_KEYS=mykey123 node src/index.js
```

```bash
curl -H "x-api-key: mykey123" http://localhost:3000/v2/health
```

```bash
curl -X POST "http://localhost:3000/v2/crawl" \
  -H "Content-Type: application/json" \
  -H "x-api-key: mykey123" \
  -d '{"urls":["https://example.com"]}'
```

## Deployment (Coolify)

1. Push repo to GitHub.
2. In Coolify, create a new resource from this repo.
3. Use `Dockerfile` build pack.
4. Set `API_KEYS` (comma-separated if multiple keys).
5. Set your API domain.
6. Deploy.
