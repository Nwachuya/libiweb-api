# libiweb API v2

Base URL: `https://api.libiweb.com`

## Authentication

All `/v2/*` endpoints require an API key header:

```http
x-api-key: your-api-key
```

## Public Endpoints

- `GET /api` — service metadata
- `GET /swagger.json` — OpenAPI spec

---

## Web Intelligence Endpoints

Powered by the self-hosted [Crawl4AI](https://crawl.sluxia.com) service.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v2/health` | Server health, uptime, version |
| `GET` | `/v2/status` | Service status |
| `POST` | `/v2/crawl` | Raw page crawl — full Crawl4AI response passthrough |
| `POST` | `/v2/map` | Internal/external link map for a URL |
| `POST` | `/v2/metadata` | Page metadata (title, OG, description) |
| `POST` | `/v2/gethtml` | Raw HTML of a page |
| `POST` | `/v2/gettext` | Cleaned plain text (markdown-first, HTML fallback) |
| `POST` | `/v2/getmarkdown` | Markdown content (`raw_markdown` → `markdown_with_citations` → `fit_markdown`) |
| `POST` | `/v2/getseo` | SEO fields merged from crawl metadata + HTML parse |
| `POST` | `/v2/getmedia` | Images, videos, audios grouped and deduped |
| `POST` | `/v2/getemails` | Email discovery — seed page + contact-pattern sub-pages (max 3 pages by default) |
| `POST` | `/v2/extract` | Regex-free extraction of `emails`, `phones`, `urls` from page text |
| `POST` | `/v2/screenshot` | Page screenshot via Crawl4AI `/screenshot` |
| `POST` | `/v2/bulk` | Async batch crawl — returns `job_id` immediately (202) |
| `GET` | `/v2/bulk/:jobId` | Poll bulk job status and results |
| `GET` | `/v2/usage` | Monthly usage summary (credits, endpoints, status codes) |
| `POST` | `/v2/webhook/register` | Register a webhook for bulk job events |

---

## Computational Endpoints

Pure-algorithm endpoints routed directly to the self-hosted [Fused Backend](https://github.com/your-org/fused-backend) Python service. No external API calls — all processing is in-process.

| Method | Path | Description |
|---|---|---|
| `POST` | `/v2/chrono` | Timezone-aware meeting overlap (sweep-line, IANA tz support) |
| `POST` | `/v2/mock` | Stateful synthetic data generation with formula DSL (`increment`, `random_int`, `if/then/else`) |
| `POST` | `/v2/fuzzy` | Fuzzy string deduplication and clustering (Jaro-Winkler) |
| `POST` | `/v2/token` | PCI-safe tokenisation — Luhn-preserving for cards, format-preserving for emails |
| `POST` | `/v2/pack` | 3D bin packing optimisation |
| `POST` | `/v2/diff` | Semantic JSON diff with RFC 6902 patch output |
| `POST` | `/v2/cast` | Schema-driven type coercion with fuzzy field name remapping |
| `POST` | `/v2/tax` | FIFO/LIFO/HIFO tax-lot cost basis and realised P&L |
| `POST` | `/v2/policy` | Rule-tree policy evaluation engine |
| `POST` | `/v2/telemetry` | IoT telemetry anomaly detection (impossible travel, Shannon entropy) |
| `POST` | `/v2/series` | Time-series gap filling, interpolation, and z-score anomaly flagging |
| `POST` | `/v2/spatial` | Geofence check (ray-casting) and distance to boundary |
| `POST` | `/v2/proration` | Tiered billing proration with tax |
| `POST` | `/v2/apca` | APCA colour-contrast ratio (accessibility) |
| `POST` | `/v2/dag` | Corporate ownership DAG analysis — cycle detection, density, audit status |
| `POST` | `/v2/enforcer` | LLM output structure enforcement and type coercion |
| `POST` | `/v2/gcode` | CNC toolpath optimisation (2-opt TSP heuristic) |
| `POST` | `/v2/bio` | Pairwise sequence alignment (Needleman-Wunsch) |
| `POST` | `/v2/bio/search` | Sequence library search — ranked by alignment score |
| `POST` | `/v2/merkle/root` | Merkle root hash (SHA-256) |
| `POST` | `/v2/merkle/proof` | Merkle inclusion proof path |
| `POST` | `/v2/aeo` | HTML → AEO/llms.txt compliant markdown |
| `POST` | `/v2/shifts` | Constraint-based shift scheduler (skills, rest hours, weekly caps) |

---

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

```bash
curl -X POST "https://api.libiweb.com/v2/chrono" \
  -H "Content-Type: application/json" \
  -H "x-api-key: mykey123" \
  -d '{
    "participants": [
      {"name":"Alice","timezone":"America/New_York","intervals":[{"start":"2024-05-01T09:00:00","end":"2024-05-01T17:00:00"}]},
      {"name":"Bob","timezone":"Europe/London","intervals":[{"start":"2024-05-01T08:00:00","end":"2024-05-01T16:00:00"}]}
    ]
  }'
```

---

## Deployment (Coolify)

### Node.js API (`libiweb-api`)

1. Push repo to GitHub.
2. In Coolify, create a new resource from this repo.
3. Use `Dockerfile` build pack.
4. Set environment variables:
   - `API_KEYS` — comma-separated valid API keys
   - `PB_URL` — PocketBase instance URL
   - `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — PocketBase admin credentials
   - `CRAWL4AI_BASE_URL` — Crawl4AI service URL (default: `https://crawl.sluxia.com`)
5. Set domain to `api.libiweb.com`.
6. Deploy.

### Fused Backend (`fused-backend`)

1. In Coolify, create a new resource from `apimink/fused-backend/`.
2. Use `Dockerfile` build pack.
3. Set environment variables:
   - `API_KEYS` — same comma-separated keys as the Node.js service
4. **Do not assign a public domain** — internal network only.
5. Deploy.

### Traefik Routing (Coolify)

Add a higher-priority routing rule on `api.libiweb.com` to forward computational endpoint paths to the Fused Backend with a `/v2/` → `/v1/` path rewrite:

```
PathPrefix: /v2/chrono, /v2/mock, /v2/fuzzy, /v2/token, /v2/pack, /v2/diff,
            /v2/cast, /v2/tax, /v2/policy, /v2/telemetry, /v2/series,
            /v2/spatial, /v2/proration, /v2/apca, /v2/dag, /v2/enforcer,
            /v2/gcode, /v2/bio, /v2/merkle, /v2/aeo, /v2/shifts
```
