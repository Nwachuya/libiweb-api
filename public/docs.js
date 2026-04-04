(() => {
  const BASE_URL = "https://api.libiweb.com";

  const ENDPOINTS = [
    {
      title: "Public API Metadata",
      method: "GET",
      path: "/api",
      auth: false,
      description: "Public service metadata.",
      response: { name: "libiweb API", version: "v2", docs: "/swagger.json", status: "online" }
    },
    {
      title: "OpenAPI Document",
      method: "GET",
      path: "/swagger.json",
      auth: false,
      description: "OpenAPI specification for this API.",
      response: { openapi: "3.0.3", info: { title: "libiweb API", version: "2.0.0" } }
    },
    {
      title: "Health Check",
      method: "GET",
      path: "/v2/health",
      auth: true,
      description: "Service health, uptime, and version.",
      response: { status: "ok", uptime: 3600, version: "v2", timestamp: "2026-04-03T10:00:00.000Z" }
    },
    {
      title: "Runtime Status",
      method: "GET",
      path: "/v2/status",
      auth: true,
      description: "Service status with uptime details.",
      response: { status: "online", service: "libiweb-api", version: "v2", uptime: 3600 }
    },
    {
      title: "Crawl",
      method: "POST",
      path: "/v2/crawl",
      auth: true,
      description: "Run crawl for one or more target URLs.",
      body: { urls: ["https://example.com"], formats: ["markdown", "html"] },
      response: { success: true, results: [{ url: "https://example.com", success: true, status_code: 200 }] }
    },
    {
      title: "Map",
      method: "POST",
      path: "/v2/map",
      auth: true,
      description: "Internal/external link mapping.",
      body: { urls: ["https://example.com"] },
      response: {
        target: "https://example.com",
        counts: { total: 2, internal: 1, external: 1 },
        internal: ["https://example.com/about"],
        external: ["https://external-site.com/page"]
      }
    },
    {
      title: "Metadata",
      method: "POST",
      path: "/v2/metadata",
      auth: true,
      description: "Normalized metadata records.",
      body: { urls: ["https://example.com"] },
      response: { count: 1, items: [{ url: "https://example.com", success: true, status_code: 200 }] }
    },
    {
      title: "Get Media",
      method: "POST",
      path: "/v2/getmedia",
      auth: true,
      description: "Normalized image/video/audio assets.",
      body: { urls: ["https://example.com"] },
      response: { target: "https://example.com", counts: { total: 2, images: 1, videos: 1, audios: 0 } }
    },
    {
      title: "Get Markdown",
      method: "POST",
      path: "/v2/getmarkdown",
      auth: true,
      description: "Normalized markdown output.",
      body: { urls: ["https://example.com"] },
      response: { count: 1, total_characters: 1280, items: [{ url: "https://example.com", success: true }] }
    },
    {
      title: "Get HTML",
      method: "POST",
      path: "/v2/gethtml",
      auth: true,
      description: "Normalized HTML output.",
      body: { urls: ["https://example.com"] },
      response: { count: 1, total_characters: 5421, items: [{ url: "https://example.com", success: true }] }
    },
    {
      title: "Get Text",
      method: "POST",
      path: "/v2/gettext",
      auth: true,
      description: "Plain text extraction.",
      body: { urls: ["https://example.com"] },
      response: { count: 1, total_characters: 640, items: [{ url: "https://example.com", success: true }] }
    },
    {
      title: "Get SEO",
      method: "POST",
      path: "/v2/getseo",
      auth: true,
      description: "SEO-focused extraction.",
      body: { urls: ["https://example.com"] },
      response: { count: 1, items: [{ url: "https://example.com", success: true, seo: { title: "Example Domain" } }] }
    },
    {
      title: "Get Emails",
      method: "POST",
      path: "/v2/getemails",
      auth: true,
      description: "Email discovery from target and linked pages.",
      body: { url: "https://example.com", max_pages: 10 },
      response: { target: "https://example.com", counts: { pages_scanned: 3, emails_found: 2 } }
    },
    {
      title: "Extract Fields",
      method: "POST",
      path: "/v2/extract",
      auth: true,
      description: "Built-in extraction for emails/phones/urls.",
      body: { urls: ["https://example.com"], fields: ["emails", "phones", "urls"] },
      response: { fields: ["emails", "phones", "urls"], count: 1 }
    },
    {
      title: "Screenshot",
      method: "POST",
      path: "/v2/screenshot",
      auth: true,
      description: "Screenshot extraction records.",
      body: { urls: ["https://example.com"], screenshot: true },
      response: { count: 1, items: [{ url: "https://example.com", success: true }] }
    },
    {
      title: "Bulk Job Create",
      method: "POST",
      path: "/v2/bulk",
      auth: true,
      description: "Queue a bulk job.",
      body: { urls: ["https://example.com/a", "https://example.com/b"] },
      response: { job_id: "job_m8bsl18f_a1b2c3d4", status: "queued", count: 2 }
    },
    {
      title: "Bulk Job Status",
      method: "GET",
      path: "/v2/bulk/:jobId",
      requestPath: "/v2/bulk/job_m8bsl18f_a1b2c3d4",
      auth: true,
      description: "Read queued/processing/completed bulk job state.",
      response: { job_id: "job_m8bsl18f_a1b2c3d4", status: "completed", count: 2 }
    },
    {
      title: "Usage Summary",
      method: "GET",
      path: "/v2/usage",
      query: "period=2026-04&scope=key",
      auth: true,
      description: "Aggregated usage for API key or account scope.",
      response: {
        period: "2026-04",
        scope: "key",
        total_requests: 12,
        total_credits: 10,
        endpoints: [{ endpoint: "/v2/crawl", requests: 5, credits: 5 }]
      }
    },
    {
      title: "Webhook Register",
      method: "POST",
      path: "/v2/webhook/register",
      auth: true,
      description: "Register callback URL for bulk events.",
      body: { url: "https://hooks.example.com/libiweb", secret: "abc123", events: ["bulk.completed", "bulk.failed"] },
      response: { owner: "key:your-api-key", webhook: { url: "https://hooks.example.com/libiweb" } }
    }
  ];

  function endpointUrl(def) {
    const path = def.requestPath || def.path;
    const query = def.query ? `?${def.query}` : "";
    return `${BASE_URL}${path}${query}`;
  }

  function prettyJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function jsSnippet(def) {
    const url = endpointUrl(def);
    const lines = [];
    lines.push(`const url = "${url}";`);
    lines.push("");
    lines.push("const response = await fetch(url, {");
    lines.push(`  method: "${def.method}",`);
    lines.push("  headers: {");
    if (def.auth) lines.push('    "x-api-key": "your-api-key",');
    if (def.body) lines.push('    "Content-Type": "application/json",');
    lines.push("  },");
    if (def.body) lines.push(`  body: JSON.stringify(${prettyJson(def.body).replace(/\n/g, "\n  ")}),`);
    lines.push("});");
    lines.push("");
    lines.push("const data = await response.json();");
    lines.push("console.log(data);");
    return lines.join("\n");
  }

  function pySnippet(def) {
    const url = endpointUrl(def);
    const lines = [];
    lines.push("import requests");
    lines.push("");
    lines.push(`url = "${url}"`);
    lines.push("headers = {");
    if (def.auth) lines.push('    "x-api-key": "your-api-key",');
    if (def.body) lines.push('    "Content-Type": "application/json",');
    lines.push("}");
    lines.push("");
    if (def.body) {
      const payload = prettyJson(def.body).replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None");
      lines.push(`payload = ${payload}`);
      lines.push(`response = requests.${def.method.toLowerCase()}(url, headers=headers, json=payload, timeout=30)`);
    } else {
      lines.push(`response = requests.${def.method.toLowerCase()}(url, headers=headers, timeout=30)`);
    }
    lines.push("data = response.json()");
    lines.push("print(data)");
    return lines.join("\n");
  }

  function curlSnippet(def) {
    const url = endpointUrl(def);
    const lines = [];
    lines.push(`curl -X ${def.method} "${url}" \\`);
    if (def.auth) lines.push('  -H "x-api-key: your-api-key" \\');
    if (def.body) lines.push('  -H "Content-Type: application/json" \\');
    if (def.body) lines.push(`  -d '${JSON.stringify(def.body)}'`);
    if (!def.body) lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\\\$/, "");
    return lines.join("\n");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function highlightCode(raw, lang) {
    let out = escapeHtml(raw);
    out = out.replace(/(^|\s)(\/\/.*$|#.*$)/gm, '$1<span class="tok-comment">$2</span>');
    out = out.replace(/("[^"\n]*"|'[^'\n]*')/g, '<span class="tok-string">$1</span>');
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');

    const keywordSets = {
      javascript: ["import", "from", "const", "await", "new", "if", "else", "true", "false", "null"],
      python: ["import", "from", "as", "if", "else", "True", "False", "None"],
      curl: ["curl"],
      response: ["true", "false", "null"]
    };

    const keywords = keywordSets[lang] || [];
    if (keywords.length) {
      const rx = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
      out = out.replace(rx, '<span class="tok-keyword">$1</span>');
    }

    if (lang === "curl") {
      out = out.replace(/(^|\s)(-X|-H|-d)(?=\s|$)/g, '$1<span class="tok-keyword">$2</span>');
    }

    return out;
  }

  function createTabbedSnippet(def) {
    const snippets = {
      javascript: jsSnippet(def),
      python: pySnippet(def),
      curl: curlSnippet(def),
      response: prettyJson(def.response)
    };

    const wrapper = document.createElement("div");
    wrapper.className = "code-snippet";

    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    const tabs = document.createElement("div");
    tabs.className = "code-tabs";

    const codeLang = document.createElement("span");
    codeLang.className = "code-lang";

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn copy-current";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";

    const panel = document.createElement("div");
    panel.className = "code-panel";

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    pre.appendChild(codeEl);
    panel.appendChild(pre);

    let active = "javascript";
    const labels = {
      javascript: "JavaScript",
      python: "Python",
      curl: "cURL",
      response: "Response"
    };

    const tabButtons = Object.keys(labels).map((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-tab";
      button.textContent = labels[key];
      button.dataset.tab = key;
      button.addEventListener("click", () => {
        active = key;
        renderActiveTab();
      });
      tabs.appendChild(button);
      return button;
    });

    function renderActiveTab() {
      tabButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tab === active);
      });
      const raw = snippets[active] || "";
      codeLang.textContent = labels[active];
      pre.dataset.lang = active;
      codeEl.innerHTML = highlightCode(raw, active);
      copyBtn.dataset.copyText = raw;
    }

    toolbar.appendChild(tabs);
    toolbar.appendChild(codeLang);
    toolbar.appendChild(copyBtn);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(panel);
    renderActiveTab();
    return wrapper;
  }

  function renderEndpoints() {
    const mount = document.getElementById("endpoint-docs");
    if (!mount) return;

    ENDPOINTS.forEach((def) => {
      const article = document.createElement("article");
      article.className = "endpoint-card";

      const title = document.createElement("h3");
      title.textContent = def.title;

      const meta = document.createElement("p");
      meta.className = "endpoint-meta";
      meta.innerHTML = `<code>${def.method}</code> <code>${def.path}</code>${def.auth ? ' <span class="badge-auth">API Key</span>' : ' <span class="badge-public">Public</span>'}`;

      const desc = document.createElement("p");
      desc.className = "endpoint-desc";
      desc.textContent = def.description;

      const snippets = document.createElement("div");
      snippets.className = "snippet-grid";
      snippets.appendChild(createTabbedSnippet(def));

      article.appendChild(title);
      article.appendChild(meta);
      article.appendChild(desc);
      article.appendChild(snippets);
      mount.appendChild(article);
    });
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const prev = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = prev;
      }, 1200);
    } catch {
      const prev = button.textContent;
      button.textContent = "Failed";
      setTimeout(() => {
        button.textContent = prev;
      }, 1200);
    }
  }

  renderEndpoints();

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".copy-btn");
    if (!button) return;
    const targetId = button.dataset.copyTarget;
    if (targetId) {
      const el = document.getElementById(targetId);
      if (!el) return;
      copyText(el.textContent || "", button);
      return;
    }
    const rawText = button.dataset.copyText;
    if (rawText) copyText(rawText, button);
  });
})();
