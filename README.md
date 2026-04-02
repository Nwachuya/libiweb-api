# libiweb API v2

Base URL: `https://api.libiweb.com`

## Authentication

All `/v2/*` endpoints require an API key passed as a header:

```
x-api-key: your-api-key-here
```

## Endpoints

### `GET /`
Public. Returns API info.

### `GET /v2/health`
Returns server health and uptime.

**Example response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-04-02T12:00:00.000Z",
  "version": "v2"
}
```

---

## Local Development

```bash
npm install
API_KEYS=mykey123 node src/index.js
```

Test it:
```bash
curl -H "x-api-key: mykey123" http://localhost:3000/v2/health
```

---

## Coolify Deployment

1. Push this repo to GitHub.
2. In Coolify → New Resource → GitHub repo → select `libiweb-api`.
3. Build pack: **Dockerfile**.
4. Set environment variable: `API_KEYS=your-secret-key` (comma-separate multiple keys).
5. Set domain: `api.libiweb.com`.
6. Deploy.

---

## Adding New Endpoints

1. Create a file in `src/routes/`, e.g. `src/routes/data.js`.
2. Register it in `src/index.js`:
   ```js
   const dataRouter = require("./routes/data");
   app.use("/v2/data", dataRouter);
   ```
3. Push to GitHub — Coolify auto-deploys on push (if webhook is set up).