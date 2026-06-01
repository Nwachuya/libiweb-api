# libiweb API v2

Base URL: `https://api.libiweb.com`

## Authentication

All `/v2/*` endpoints require an API key header:

```http
x-api-key: your-api-key
```

---

## Public Endpoints

### GET /api
Returns service metadata. No auth required.

```bash
curl https://api.libiweb.com/api
```
```json
{ "name": "libiweb API", "version": "v2", "docs": "/swagger.json", "status": "online" }
```

---

## Web Intelligence Endpoints

Powered by self-hosted [Crawl4AI](https://crawl.sluxia.com). All POST endpoints accept `"url"` (single) or `"urls"` (array).

---

### GET /v2/health

```bash
curl https://api.libiweb.com/v2/health -H "x-api-key: YOUR_KEY"
```
```json
{ "status": "ok", "uptime": 3600, "timestamp": "2026-06-01T10:00:00.000Z", "version": "v2" }
```

---

### GET /v2/status

```bash
curl https://api.libiweb.com/v2/status -H "x-api-key: YOUR_KEY"
```
```json
{ "status": "online", "service": "libiweb-api", "version": "v2", "uptime": 3600, "timestamp": "2026-06-01T10:00:00.000Z" }
```

---

### POST /v2/crawl

Raw page crawl — full Crawl4AI response passthrough. Use this when you need the complete crawl result including HTML, markdown, links, media, and metadata in one call.

**Request**
```json
{ "url": "https://example.com" }
```
| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | yes (or `urls`) | Single URL to crawl |
| `urls` | string[] | yes (or `url`) | Multiple URLs to crawl |

**Response** — raw Crawl4AI envelope:
```json
{
  "success": true,
  "results": [{
    "url": "https://example.com",
    "html": "<!DOCTYPE html>...",
    "markdown": { "raw_markdown": "...", "markdown_with_citations": "..." },
    "metadata": { "title": "...", "description": "..." },
    "links": { "internal": [...], "external": [...] },
    "media": { "images": [...], "videos": [], "audios": [] },
    "status_code": 200,
    "success": true
  }]
}
```

---

### POST /v2/map

Returns deduplicated internal and external link maps for a URL.

**Request**
```json
{ "url": "https://libiweb.com" }
```

**Response**
```json
{
  "target": "https://libiweb.com",
  "counts": { "total": 21, "internal": 20, "external": 1 },
  "internal": ["https://libiweb.com/about", "https://libiweb.com/contact"],
  "external": ["https://www.facebook.com/libiweb"],
  "all": ["https://libiweb.com/about", "..."]
}
```

---

### POST /v2/metadata

Returns page metadata: title, description, Open Graph, and Twitter Card fields.

**Request**
```json
{ "url": "https://libiweb.com" }
```

**Response**
```json
{
  "count": 1,
  "items": [{
    "url": "https://libiweb.com",
    "redirected_url": "https://libiweb.com/",
    "success": true,
    "status_code": 200,
    "metadata": {
      "title": "LibiWeb Digital",
      "description": "LibiWeb is a digital agency...",
      "og:title": "Home",
      "og:image": "https://libiweb.com/wp-content/uploads/2024/04/automation.png",
      "twitter:card": "summary_large_image"
    }
  }]
}
```

---

### POST /v2/gethtml

Returns raw HTML of a page.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "count": 1,
  "total_characters": 1256,
  "items": [{
    "url": "https://example.com",
    "redirected_url": "https://example.com/",
    "success": true,
    "status_code": 200,
    "html": "<!DOCTYPE html><html>...</html>"
  }]
}
```

---

### POST /v2/gettext

Returns cleaned plain text extracted from a page. Prefers markdown over raw HTML.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "count": 1,
  "total_characters": 412,
  "items": [{
    "url": "https://example.com",
    "redirected_url": "https://example.com/",
    "success": true,
    "status_code": 200,
    "text": "Example Domain This domain is for use in documentation..."
  }]
}
```

---

### POST /v2/getmarkdown

Returns page content as markdown. Priority: `raw_markdown` → `markdown_with_citations` → `fit_markdown`.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "count": 1,
  "total_characters": 890,
  "items": [{
    "url": "https://example.com",
    "success": true,
    "status_code": 200,
    "markdown": "# Example Domain\n\nThis domain is for use in...",
    "markdown_with_citations": "# Example Domain\n\n...[1]",
    "references_markdown": "[1]: https://www.iana.org/..."
  }]
}
```

---

### POST /v2/getseo

Returns SEO fields merged from crawl metadata and HTML parsing. Covers title, description, keywords, canonical, robots, Open Graph, and Twitter Card.

**Request**
```json
{ "url": "https://libiweb.com" }
```

**Response**
```json
{
  "count": 1,
  "items": [{
    "url": "https://libiweb.com",
    "success": true,
    "status_code": 200,
    "seo": {
      "title": "LibiWeb Digital",
      "description": "LibiWeb is a digital agency...",
      "keywords": "",
      "robots": "max-image-preview:large",
      "canonical": "https://libiweb.com/",
      "og": { "title": "Home", "description": "...", "image": "...", "url": "...", "type": "website" },
      "twitter": { "card": "summary_large_image", "title": "Home", "description": "...", "image": "..." }
    }
  }]
}
```

---

### POST /v2/getmedia

Returns all images, videos, and audios found on a page, deduplicated and grouped by type.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "target": "https://example.com",
  "counts": { "total": 3, "images": 3, "videos": 0, "audios": 0 },
  "images": [{ "src": "https://example.com/logo.png", "type": "image", "alt": "Logo", "format": "png", "score": 4 }],
  "videos": [],
  "audios": [],
  "all": [...]
}
```

---

### POST /v2/getemails

Discovers emails across the seed page and contact-pattern sub-pages (contact, about, team, etc.). Deduplicates and tracks which pages each email appeared on.

**Request**
```json
{ "url": "https://libiweb.com", "max_pages": 3 }
```
| Field | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Target site |
| `max_pages` | integer | `3` | Max pages to scan (cap: 10) |

**Response**
```json
{
  "target": "https://libiweb.com",
  "counts": { "pages_scanned": 3, "candidate_pages": 2, "emails_found": 1 },
  "scanned_pages": ["https://libiweb.com", "https://libiweb.com/about", "https://libiweb.com/contact"],
  "emails": [{ "email": "work@libiweb.com", "sources": ["https://libiweb.com", "https://libiweb.com/contact"] }]
}
```

---

### POST /v2/extract

Extracts structured data from page text using built-in regex patterns. No LLM or custom schema required.

**Request**
```json
{ "url": "https://example.com", "fields": ["emails", "phones", "urls"] }
```
| Field | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Page to extract from |
| `fields` | string[] | `["emails","phones"]` | Fields to extract. Supported: `emails`, `phones`, `urls` |

**Response**
```json
{
  "fields": ["emails", "phones", "urls"],
  "count": 1,
  "items": [{
    "url": "https://example.com",
    "success": true,
    "status_code": 200,
    "extracted": {
      "emails": ["hello@example.com"],
      "phones": ["+1 415 555 0123"],
      "urls": ["https://example.com/about"]
    }
  }]
}
```

---

### POST /v2/screenshot

Returns a screenshot of the page captured by Crawl4AI.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "count": 1,
  "items": [{
    "url": "https://example.com",
    "success": true,
    "status_code": 200,
    "screenshot": { "screenshot": "<base64-encoded-png>" }
  }]
}
```

---

### POST /v2/bulk

Submits an async crawl job. Returns immediately with a `job_id`. Poll `GET /v2/bulk/:jobId` for completion.

**Request**
```json
{ "urls": ["https://example.com/a", "https://example.com/b"] }
```

**Response (202)**
```json
{ "job_id": "job_abc123_def456", "status": "queued", "count": 2 }
```

---

### GET /v2/bulk/:jobId

Polls a bulk job created with `POST /v2/bulk`.

```bash
curl https://api.libiweb.com/v2/bulk/job_abc123_def456 -H "x-api-key: YOUR_KEY"
```

**Response**
```json
{
  "job_id": "job_abc123_def456",
  "status": "completed",
  "created_at": "2026-06-01T10:00:00.000Z",
  "updated_at": "2026-06-01T10:00:03.000Z",
  "urls": ["https://example.com/a", "https://example.com/b"],
  "result": {
    "count": 2,
    "items": [
      { "url": "https://example.com/a", "success": true, "status_code": 200 },
      { "url": "https://example.com/b", "success": true, "status_code": 200 }
    ]
  },
  "error": null
}
```
`status` values: `queued` → `processing` → `completed` | `failed`

---

### GET /v2/usage

Returns usage summary for the current billing period, scoped to your API key or full account.

```bash
curl "https://api.libiweb.com/v2/usage?period=2026-06&scope=key" -H "x-api-key: YOUR_KEY"
```
| Query param | Default | Description |
|---|---|---|
| `period` | current month | Format: `YYYY-MM` |
| `scope` | `key` | `key` (this key only) or `account` (all keys on the account) |

**Response**
```json
{
  "period": "2026-06",
  "scope": "key",
  "total_requests": 42,
  "total_credits": 38,
  "endpoints": [
    { "endpoint": "/v2/gethtml", "requests": 20, "credits": 20 },
    { "endpoint": "/v2/getseo", "requests": 22, "credits": 18 }
  ],
  "status_codes": { "200": 38, "400": 4 }
}
```

---

### POST /v2/webhook/register

Registers a webhook URL to receive events when a bulk job completes or fails. One webhook per API key — re-posting overwrites the previous registration.

**Request**
```json
{
  "url": "https://your-server.com/hooks/libiweb",
  "secret": "optional-signing-secret",
  "events": ["bulk.completed", "bulk.failed"]
}
```
| Field | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | HTTPS endpoint to POST events to |
| `secret` | string | `""` | If set, events are signed with `x-libiweb-signature: HMAC-SHA256(body, secret)` |
| `events` | string[] | `["bulk.completed","bulk.failed"]` | Events to subscribe to |

**Response**
```json
{
  "owner": "your-api-key-id",
  "webhook": {
    "url": "https://your-server.com/hooks/libiweb",
    "events": ["bulk.completed", "bulk.failed"],
    "updated_at": "2026-06-01T10:00:00.000Z"
  }
}
```

**Webhook payload (delivered to your URL)**
```json
{
  "event": "bulk.completed",
  "job_id": "job_abc123_def456",
  "status": "completed",
  "result": { "count": 2, "items": [...] }
}
```

---

## Computational Endpoints

Pure-algorithm endpoints — no external calls, all processing in-process. All accept `Content-Type: application/json`.

---

### POST /v2/chrono

Finds common availability windows across participants in different timezones. Uses sweep-line intersection with full IANA timezone and DST support.

**Request**
```json
{
  "participants": [
    {
      "name": "Alice",
      "timezone": "America/New_York",
      "intervals": [{ "start": "2024-05-01T09:00:00", "end": "2024-05-01T17:00:00" }]
    },
    {
      "name": "Bob",
      "timezone": "Europe/London",
      "intervals": [{ "start": "2024-05-01T08:00:00", "end": "2024-05-01T16:00:00" }]
    }
  ]
}
```
| Field | Type | Description |
|---|---|---|
| `participants[].name` | string | Participant name |
| `participants[].timezone` | string | IANA timezone (e.g. `America/New_York`) |
| `participants[].intervals[].start` | string | ISO-8601 local time |
| `participants[].intervals[].end` | string | ISO-8601 local time |

**Response**
```json
{ "intersections": [{ "start": "2024-05-01T13:00:00+00:00", "end": "2024-05-01T15:00:00+00:00" }] }
```

---

### POST /v2/mock

Generates stateful synthetic data using a formula DSL. Seed for deterministic output.

**Request**
```json
{
  "rows": 3,
  "seed": 42,
  "schema_definition": {
    "id": "increment",
    "name": "random_name",
    "score": "random_int(0,100)",
    "grade": "if score >= 50 then pass else fail"
  }
}
```
| Formula | Description |
|---|---|
| `increment` | Auto-incrementing integer from 1 |
| `random_int(min, max)` | Random integer in range |
| `random_name` | Random name from built-in set |
| `if {field} {op} {val} then {a} else {b}` | Conditional referencing prior fields in the same row |

**Response**
```json
{ "data": [{ "id": 1, "name": "Bob", "score": 3, "grade": "fail" }, ...] }
```

---

### POST /v2/fuzzy

Deduplicates and clusters a list of strings using Jaro-Winkler similarity.

**Request**
```json
{ "items": ["Apple Inc", "Apple Inc.", "Microsoft Corp", "Microsoft Corporation"], "threshold": 0.85 }
```
| Field | Type | Default | Description |
|---|---|---|---|
| `items` | string[] | required | Strings to cluster |
| `threshold` | float | `0.85` | Similarity threshold (0–1). Higher = stricter matching |

**Response**
```json
{ "clusters": [["Apple Inc", "Apple Inc."], ["Microsoft Corp"], ["Microsoft Corporation"]] }
```

---

### POST /v2/token

PCI-safe tokenisation. Credit cards use Luhn-preserving tokenisation (token passes Luhn check). Emails preserve format.

**Request**
```json
{ "data": "4111111111111111", "type": "credit_card", "salt": "your-secret-salt" }
```
| Field | Type | Description |
|---|---|---|
| `data` | string | Value to tokenise |
| `type` | string | `credit_card` or `email` |
| `salt` | string | Secret salt — same salt always produces the same token |

**Response**
```json
{ "token": "d6c005134ac50dec0e01cbc4aeaf3fbdb511c4ceeb55f909c29def3b0cffba36" }
```

---

### POST /v2/pack

3D bin packing — fits items into a container, returns placed positions and any items that didn't fit.

**Request**
```json
{
  "bin": { "w": 10, "h": 10, "d": 10 },
  "items": [
    { "id": "box-a", "w": 4, "h": 4, "d": 4 },
    { "id": "box-b", "w": 6, "h": 6, "d": 6 }
  ]
}
```

**Response**
```json
{
  "fit": [
    { "id": "box-b", "x": 0, "y": 0, "z": 0, "w": 6, "h": 6, "d": 6 },
    { "id": "box-a", "x": 6, "y": 0, "z": 0, "w": 4, "h": 4, "d": 4 }
  ],
  "not_fit": []
}
```

---

### POST /v2/diff

Semantic JSON diff — compares two objects and returns a RFC 6902 JSON Patch.

**Request**
```json
{
  "source": { "name": "Alice", "age": 30, "city": "London" },
  "target": { "name": "Alice", "age": 31, "country": "UK" }
}
```

**Response**
```json
{
  "patch": [
    { "op": "remove", "path": "/city" },
    { "op": "add", "path": "/country", "value": "UK" },
    { "op": "replace", "path": "/age", "value": 31 }
  ]
}
```

---

### POST /v2/cast

Schema-driven type coercion with fuzzy field name remapping. Maps messy input fields to a clean schema even when names don't match exactly.

**Request**
```json
{
  "payload": [{ "user_name": "Alice", "user_age": "30", "active": "yes" }],
  "schema_definition": { "name": "str", "age": "int", "is_active": "bool" },
  "fuzzy_threshold": 0.8
}
```
| Type | Values accepted |
|---|---|
| `str` | Any value, cast to string |
| `int` | Numeric strings, floats truncated |
| `float` | Numeric strings |
| `bool` | `true/false`, `yes/no`, `1/0`, `on/off` |

**Response**
```json
{
  "healed": [{ "name": "Alice", "age": 30, "is_active": true }],
  "remaps": { "user_name": "name", "user_age": "age", "active": "is_active" }
}
```

---

### POST /v2/tax

Calculates realised P&L and remaining lots for a series of buy/sell transactions using FIFO, LIFO, or HIFO cost basis method.

**Request**
```json
{
  "method": "FIFO",
  "transactions": [
    { "type": "buy",  "qty": 10, "price": 100, "timestamp": "2023-01-01T00:00:00" },
    { "type": "buy",  "qty": 5,  "price": 120, "timestamp": "2023-03-01T00:00:00" },
    { "type": "sell", "qty": 8,  "price": 150, "timestamp": "2023-06-01T00:00:00" }
  ]
}
```
| Method | Description |
|---|---|
| `FIFO` | First in, first out |
| `LIFO` | Last in, first out |
| `HIFO` | Highest cost first |

**Response**
```json
{
  "realized_pnl": 400.0,
  "remaining_lots": [
    { "qty": 2, "price": 100, "timestamp": "2023-01-01T00:00:00" },
    { "qty": 5, "price": 120, "timestamp": "2023-03-01T00:00:00" }
  ]
}
```

---

### POST /v2/policy

Evaluates a nested rule tree against a set of attributes. Supports AND, OR, NOT and comparison operators.

**Request**
```json
{
  "rules": {
    "AND": [
      { "gte": ["age", 18] },
      { "OR": [{ "eq": ["country", "US"] }, { "eq": ["country", "CA"] }] }
    ]
  },
  "attributes": { "age": 25, "country": "US" }
}
```
| Operator | Usage |
|---|---|
| `AND`, `OR` | `{ "AND": [rule, rule, ...] }` |
| `NOT` | `{ "NOT": rule }` |
| `eq`, `neq` | `{ "eq": ["field", value] }` |
| `gt`, `gte`, `lt`, `lte` | `{ "gte": ["field", 18] }` |
| `in` | `{ "in": ["field", [val1, val2]] }` |

**Response**
```json
{ "allowed": true }
```

---

### POST /v2/telemetry

Analyses a sequence of IoT location events for anomalies: impossible travel speed, Shannon entropy spikes in user agents.

**Request**
```json
{
  "points": [
    { "lat": 40.7, "lon": -74.0, "timestamp": "2024-01-01T10:00:00", "user_agent": "Mozilla/5.0" },
    { "lat": 51.5, "lon": -0.12,  "timestamp": "2024-01-01T10:05:00", "user_agent": "SuspiciousBot/1.0" }
  ]
}
```

**Response**
```json
{
  "status": "SUSPICIOUS",
  "impossible_travel": true,
  "segments": [{
    "segment": "0 to 1",
    "distance_km": 5570.4,
    "required_speed_kmh": 66844.8,
    "is_suspicious": true,
    "entropy": { "p1": 3.28, "p2": 2.91 }
  }]
}
```

---

### POST /v2/series

Fills gaps in time-series data, interpolates missing values, smooths with Savitzky-Golay, and flags z-score anomalies.

**Request**
```json
{
  "data": [
    { "timestamp": "2024-01-01T00:00:00", "value": 10.0 },
    { "timestamp": "2024-01-01T00:05:00", "value": 20.0 },
    { "timestamp": "2024-01-01T00:10:00", "value": 15.0 }
  ],
  "interval_seconds": 60
}
```

**Response**
```json
{
  "summary": { "start": "2024-01-01T00:00:00", "end": "2024-01-01T00:10:00", "count": 11, "mean": 15.9, "std": 2.86 },
  "processed": [{ "timestamp": "2024-01-01T00:00:00", "value": 10.0, "z_score": 2.07 }, ...],
  "anomalies": []
}
```

---

### POST /v2/spatial

Checks whether a point is inside a polygon (ray-casting / Jordan Curve Theorem) and returns distance to the nearest boundary.

**Request**
```json
{
  "point": { "lat": 48.8566, "lng": 2.3522 },
  "polygon": [
    { "lat": 48.87, "lng": 2.33 },
    { "lat": 48.87, "lng": 2.37 },
    { "lat": 48.84, "lng": 2.37 },
    { "lat": 48.84, "lng": 2.33 }
  ]
}
```

**Response**
```json
{
  "is_inside": true,
  "distance_to_boundary_m": 1303.08,
  "algorithm": "Ray-Casting (Jordan Curve Theorem)",
  "geometry": { "point": { "lat": 48.8566, "lng": 2.3522 }, "polygon_vertices": 4 }
}
```

---

### POST /v2/proration

Calculates tiered billing proration when a plan changes mid-cycle. Supports tiered pricing, seat multipliers, and tax.

**Request**
```json
{
  "cycle_start": "2024-01-01",
  "cycle_end": "2024-01-31",
  "change_timestamp": "2024-01-15",
  "old_tiers": [{ "min_qty": 0, "unit_price": 10 }],
  "new_tiers": [{ "min_qty": 0, "unit_price": 20 }],
  "usage": 50,
  "seats": 1,
  "tax_rate": 0.1
}
```
| Field | Description |
|---|---|
| `old_tiers` / `new_tiers` | Array of `{ min_qty, max_qty?, unit_price }` |
| `usage` | Units consumed in the cycle |
| `tax_rate` | Decimal (e.g. `0.1` = 10%) |

**Response**
```json
{
  "metadata": { "billing_cycle": "monthly", "days_in_cycle": 30, "ratios": { "old": 0.4667, "new": 0.5333 } },
  "calculation": {
    "old_period_prorated": 233.33,
    "new_period_prorated": 533.33,
    "subtotal": 766.67,
    "tax_rate": "10.0%",
    "tax_amount": 76.67,
    "total_due": 843.33
  }
}
```

---

### POST /v2/apca

Calculates the APCA (Advanced Perceptual Contrast Algorithm) colour contrast score between text and background colours. More accurate than WCAG 2.x for modern displays.

**Request**
```json
{ "text_color": "#000000", "bg_color": "#ffffff", "generate_tonal_range": false }
```

**Response**
```json
{
  "contrast_score": 161.8,
  "accessibility": {
    "body_text_pass": true,
    "large_text_pass": true,
    "fluent_ui_standard": "Pass"
  },
  "tonal_range": null
}
```

---

### POST /v2/dag

Analyses a corporate ownership graph (DAG) for circular ownership, controlling paths, and audit flags using NetworkX.

**Request**
```json
{
  "relationships": [
    { "source": "CompanyA", "target": "CompanyB", "ownership_percent": 60 },
    { "source": "CompanyB", "target": "CompanyC", "ownership_percent": 80 },
    { "source": "CompanyC", "target": "CompanyA", "ownership_percent": 10 }
  ]
}
```

**Response**
```json
{
  "is_acyclic": false,
  "audit_status": "Flagged",
  "cycles_detected": 1,
  "conflicts": [["CompanyA", "CompanyB", "CompanyC"]],
  "summary": { "total_entities": 3, "total_relationships": 3, "graph_density": 0.5 }
}
```

---

### POST /v2/enforcer

Parses and coerces LLM output (including markdown-wrapped JSON) into a strict typed schema. Handles trailing commas, type mismatches, and string booleans.

**Request**
```json
{
  "raw_output": "```json\n{\"age\": \"25\", \"active\": \"yes\", \"score\": \"3.14\"}\n```",
  "target_schema": { "age": "int", "active": "bool", "score": "float" }
}
```
| Schema type | Accepted inputs |
|---|---|
| `int` | `"25"`, `25`, `25.9` (truncated) |
| `float` | `"3.14"`, `3` |
| `bool` | `"yes"/"no"`, `"true"/"false"`, `1/0` |
| `str` | Any value |

**Response**
```json
{
  "success": true,
  "enforced_object": { "age": 25, "active": true, "score": 3.14 },
  "audit": ["Coerced 'age' from str to int", "Coerced 'active' from str to bool", "Coerced 'score' from str to float"],
  "original_had_markdown": true
}
```

---

### POST /v2/gcode

Optimises a CNC toolpath using the 2-opt TSP heuristic to minimise total travel distance.

**Request**
```json
{
  "points": [
    { "x": 0, "y": 0, "z": 0 },
    { "x": 10, "y": 0, "z": 0 },
    { "x": 10, "y": 10, "z": 0 },
    { "x": 5, "y": 5, "z": 5 }
  ]
}
```

**Response**
```json
{
  "original_total_distance": 38.66,
  "optimized_total_distance": 38.66,
  "efficiency_gain": "0.0%",
  "optimized_points": [{ "x": 0, "y": 0, "z": 0 }, ...],
  "algorithm": "2-opt TSP Heuristic (Iterative Path Uncrossing)"
}
```

---

### POST /v2/bio

Pairwise global sequence alignment using Needleman-Wunsch. Returns similarity score, alignment, and variation audit trail.

**Request**
```json
{
  "seq1": "ACGTACGT",
  "seq2": "ACGTTCGT",
  "match_score": 1,
  "mismatch_penalty": -1,
  "gap_penalty": -2
}
```

**Response**
```json
{
  "similarity_index": "87.5%",
  "alignment_score": 6,
  "alignment": { "seq1": "ACGTACGT", "seq2": "ACGTTCGT" },
  "audit_trail": { "total_variations": 1, "details": ["Substitution at pos 5: A → T"] },
  "inference": "Significant genetic drift",
  "algorithm": "Needleman-Wunsch (Pairwise Global)"
}
```

---

### POST /v2/bio/search

Aligns a query sequence against a library of candidates and returns results ranked by alignment score.

**Request**
```json
{
  "primary_sequence": "ACGTACGT",
  "candidates": ["ACGTACGT", "TTTTTTTT", "ACGTTCGT"],
  "match_score": 1,
  "mismatch_penalty": -1,
  "gap_penalty": -2
}
```

**Response**
```json
{
  "matches_found": 3,
  "top_match": { "target": "ACGTACGT", "similarity_index": "100.0%", "score": 8 },
  "ranked_results": [
    { "target": "ACGTACGT", "similarity_index": "100.0%", "score": 8 },
    { "target": "ACGTTCGT", "similarity_index": "87.5%",  "score": 6 },
    { "target": "TTTTTTTT", "similarity_index": "25.0%",  "score": -4 }
  ]
}
```

---

### POST /v2/merkle/root

Builds a SHA-256 Merkle tree from a list of data blocks and returns the root hash.

**Request**
```json
{ "data_blocks": ["tx1", "tx2", "tx3", "tx4"] }
```

**Response**
```json
{
  "merkle_root": "773bc304a3b0a626a520a8d6eacc36809ac18c0b174f3ff3cdaf0a4e9c64433d",
  "leaf_count": 4,
  "tree_depth": 3,
  "algorithm": "Merkle Tree (SHA-256 Recursive Hashing)"
}
```

---

### POST /v2/merkle/proof

Generates an inclusion proof path for a specific block, enabling zero-knowledge verification against the root.

**Request**
```json
{ "data_blocks": ["tx1", "tx2", "tx3", "tx4"], "target_index": 0 }
```

**Response**
```json
{
  "target_data": "tx1",
  "merkle_root": "773bc304a3b0a626a520a8d6eacc36809ac18c0b174f3ff3cdaf0a4e9c64433d",
  "proof_path": [
    { "position": "right", "hash": "27ca64c092a959c7edc525ed45e845b1de6a7590d173fd2fad9133c8a779a1e3" },
    { "position": "right", "hash": "850cf301915d09ebcfa84e2ee4087025e17a6fca7e4149ce02cff94cd3db55de" }
  ],
  "note": "Automates Zero-Knowledge verification by providing the sibling path."
}
```

---

### POST /v2/aeo

Converts raw HTML to AEO (Answer Engine Optimisation) markdown — clean, structured, llms.txt compliant format suited for AI ingestion.

**Request**
```json
{
  "html": "<h1>Welcome</h1><p>This is a <strong>test</strong> page.</p>",
  "include_summary_block": true
}
```
| Field | Type | Default | Description |
|---|---|---|---|
| `html` | string | one of `html`/`url` | Raw HTML to convert |
| `url` | string | one of `html`/`url` | Fetch and convert a live URL |
| `include_summary_block` | boolean | `true` | Prepend a `[!SUMMARY]` block |

**Response**
```json
{
  "title": "Welcome",
  "aeo_markdown": "# Welcome\n\n> [!SUMMARY]\n> This is a test page.\n\nThis is a test page.",
  "word_count": 7,
  "optimization_status": "LLM-Ready",
  "format": "llms.txt compliant"
}
```

---

### POST /v2/shifts

Constraint-based shift scheduler. Assigns employees to shifts respecting skill requirements, max weekly hours, unavailability windows, and minimum rest periods between shifts.

**Request**
```json
{
  "employees": [
    { "id": "emp1", "skills": ["barista"], "max_weekly_hours": 40, "unavailable_windows": [] },
    { "id": "emp2", "skills": ["barista", "cashier"], "max_weekly_hours": 30 }
  ],
  "shifts": [
    {
      "id": "morning",
      "start": "2024-05-01T08:00:00",
      "end": "2024-05-01T14:00:00",
      "requirements": [{ "skill": "barista", "count": 1 }]
    },
    {
      "id": "evening",
      "start": "2024-05-01T16:00:00",
      "end": "2024-05-01T22:00:00",
      "requirements": [{ "skill": "cashier", "count": 1 }]
    }
  ],
  "min_rest_hours": 2
}
```

**Response**
```json
{
  "status": "SUCCESS",
  "team_assignments": {
    "morning": { "barista": ["emp1"] },
    "evening": { "cashier": ["emp2"] }
  },
  "unfillable_report": [],
  "utilization": { "emp1": 1, "emp2": 1 },
  "algorithm": "Heterogeneous Team Constraint Solver"
}
```
`status` values: `SUCCESS` (all shifts filled) or `PARTIAL` (some shifts unfillable — check `unfillable_report`).

---

## Quick Start

```bash
npm install
API_KEYS=mykey123 node src/index.js
```

```bash
curl -H "x-api-key: mykey123" http://localhost:3000/v2/health
```

---

## Deployment (Coolify — Nixpacks)

Both the Node.js API and the Python Fused Backend run in the same container. `nixpacks.toml` installs both runtimes and their dependencies. `start.sh` boots uvicorn in the background then starts Node.js in the foreground.

```
api.libiweb.com  →  Node.js (port 3000)
                       ├── /v2/crawl, /v2/map ...   handled directly
                       └── /v2/chrono, /v2/mock ...  proxied to uvicorn (localhost:8001)
```

1. Push repo to GitHub.
2. In Coolify, create a new resource from this repo.
3. Use **Nixpacks** build pack.
4. Set environment variables:
   - `API_KEYS` — comma-separated valid API keys
   - `PB_URL` — PocketBase instance URL
   - `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — PocketBase admin credentials
   - `CRAWL4AI_BASE_URL` — Crawl4AI service URL (default: `https://crawl.sluxia.com`)
5. Set domain to `api.libiweb.com`.
6. Deploy.
