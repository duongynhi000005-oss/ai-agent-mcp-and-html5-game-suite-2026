/**
 * AI Agent MCP Server + RapidAPI + x402 Pay-Per-Request Edge Worker (2026 Edition)
 * Supports:
 *  - Model Context Protocol (MCP JSON-RPC 2.0 over Streamable HTTP at POST/GET /mcp)
 *  - OpenAPI 3.1 Spec at GET /openapi.json (for RapidAPI / OpenAI GPT Actions)
 *  - REST Endpoints: /v1/scrape, /v1/seo-audit, /v1/security-audit, /v1/crypto-intel
 *  - x402 Payment Protocol headers for autonomous AI Agent micropayments (USDC on Base/Solana)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RapidAPI-Key, X-RapidAPI-Proxy-Secret, X-Payment-Token',
  'X-Payment-Address-Base-USDC': '0x949934c6b9f88f4c55b0b6d11d2f18a088c82f4e',
  'X-Price-Per-Call-USD': '0.002'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    }
  });
}

function htmlToCleanMarkdown(html, baseUrl) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const headings = [];
  const hRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = hRegex.exec(text)) !== null && headings.length < 40) {
    const cleanH = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (cleanH) headings.push({ level: Number(m[1]), text: cleanH });
  }

  const links = [];
  const aRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = aRegex.exec(text)) !== null && links.length < 50) {
    try {
      const href = new URL(m[1], baseUrl).href;
      const anchor = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (href.startsWith('http') && anchor) links.push({ text: anchor.slice(0, 80), url: href });
    } catch (_) {}
  }

  let md = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    url: baseUrl,
    title,
    description,
    wordCount: md.split(/\s+/).filter(Boolean).length,
    headings,
    links: links.slice(0, 25),
    markdown: md.slice(0, 25000)
  };
}

async function runScrapeTool(targetUrl) {
  const u = new URL(targetUrl);
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }
  const t0 = Date.now();
  const resp = await fetch(u.href, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAgentMCPBot/1.0; +https://glama.ai/mcp)' },
    redirect: 'follow'
  });
  const html = await resp.text();
  const parsed = htmlToCleanMarkdown(html, u.href);
  return {
    status: resp.status,
    latencyMs: Date.now() - t0,
    ...parsed
  };
}

async function runSeoAuditTool(targetUrl) {
  const u = new URL(targetUrl);
  const t0 = Date.now();
  const resp = await fetch(u.href, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAgentSEOBot/1.0)' }
  });
  const html = await resp.text();
  const parsed = htmlToCleanMarkdown(html, u.href);

  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasJsonLd = /application\/ld\+json/i.test(html);
  const h1Count = parsed.headings.filter((h) => h.level === 1).length;

  const issues = [];
  let score = 100;
  if (!parsed.title) { score -= 20; issues.push('Missing <title> tag'); }
  else if (parsed.title.length < 25 || parsed.title.length > 65) { score -= 5; issues.push(`Title length (${parsed.title.length} chars) outside optimal 25-65 range`); }
  if (!parsed.description) { score -= 15; issues.push('Missing meta description'); }
  if (h1Count === 0) { score -= 15; issues.push('Missing <h1> heading'); }
  if (h1Count > 1) { score -= 5; issues.push(`Multiple <h1> headings found (${h1Count})`); }
  if (!hasCanonical) { score -= 10; issues.push('Missing rel="canonical" link'); }
  if (!hasOgTitle || !hasOgImage) { score -= 10; issues.push('Incomplete OpenGraph (og:title / og:image) tags'); }
  if (!hasViewport) { score -= 10; issues.push('Missing mobile viewport meta tag'); }
  if (!hasJsonLd) { score -= 5; issues.push('No Schema.org JSON-LD structured data detected'); }

  return {
    url: u.href,
    seoScore: Math.max(0, score),
    latencyMs: Date.now() - t0,
    metrics: {
      title: parsed.title,
      titleLength: parsed.title.length,
      description: parsed.description,
      descriptionLength: parsed.description.length,
      wordCount: parsed.wordCount,
      h1Count,
      totalHeadings: parsed.headings.length,
      hasCanonical,
      hasOgTitle,
      hasOgImage,
      hasViewport,
      hasJsonLd
    },
    issues
  };
}

async function runSecurityAuditTool(targetUrl) {
  const u = new URL(targetUrl);
  const resp = await fetch(u.href, { method: 'GET', redirect: 'manual' });
  const h = resp.headers;
  const requiredHeaders = [
    ['strict-transport-security', 'HSTS (Strict-Transport-Security)', 20],
    ['content-security-policy', 'CSP (Content-Security-Policy)', 25],
    ['x-frame-options', 'Clickjacking Protection (X-Frame-Options)', 15],
    ['x-content-type-options', 'MIME Sniffing Protection (X-Content-Type-Options)', 15],
    ['referrer-policy', 'Referrer-Policy', 10],
    ['permissions-policy', 'Permissions-Policy', 15]
  ];

  let score = 100;
  const findings = [];
  const presentHeaders = {};

  for (const [key, label, weight] of requiredHeaders) {
    const val = h.get(key);
    if (val) {
      presentHeaders[key] = val;
    } else {
      score -= weight;
      findings.push({ severity: weight >= 20 ? 'HIGH' : 'MEDIUM', header: key, message: `Missing ${label} header` });
    }
  }

  const serverBanner = h.get('server') || h.get('x-powered-by') || '';
  if (serverBanner) {
    findings.push({ severity: 'LOW', header: 'server/x-powered-by', message: `Information disclosure via banner: ${serverBanner}` });
  }

  return {
    url: u.href,
    securityScore: Math.max(0, score),
    grade: score >= 90 ? 'A+' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'F',
    https: u.protocol === 'https:',
    presentHeaders,
    findings
  };
}

const MCP_TOOLS = [
  {
    name: 'scrape_clean_markdown',
    description: 'Fetch any web URL and convert its content into clean LLM-ready Markdown, extracting title, meta description, headings, and canonical links.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full HTTP/HTTPS URL to scrape' }
      },
      required: ['url']
    }
  },
  {
    name: 'seo_vitals_audit',
    description: 'Run a comprehensive technical SEO audit on any URL (title/meta length, H1-H3 hierarchy, OpenGraph, canonical, JSON-LD schema, and actionable score 0-100).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full HTTP/HTTPS URL to audit' }
      },
      required: ['url']
    }
  },
  {
    name: 'security_headers_cve_audit',
    description: 'Audit any domain or endpoint for OWASP HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) and server banner leaks.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target HTTPS/HTTP URL to scan' }
      },
      required: ['url']
    }
  }
];

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'AI Agent Web Scraper, SEO & Security Auditor Pro API (MCP + REST)',
    version: '1.0.0',
    description: 'High-speed Cloudflare Edge API & Model Context Protocol (MCP) server for AI Agents, RapidAPI consumers, and x402 autonomous workflows.'
  },
  servers: [
    { url: 'https://ai-agent-mcp-scraper-seo-security-pro.duongynhi000005.workers.dev' }
  ],
  paths: {
    '/v1/scrape': {
      post: {
        operationId: 'scrapeCleanMarkdown',
        summary: 'Scrape URL to clean LLM Markdown + structured links/headings',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } }
        },
        responses: { '200': { description: 'Clean Markdown & metadata' } }
      }
    },
    '/v1/seo-audit': {
      post: {
        operationId: 'seoVitalsAudit',
        summary: 'Audit technical SEO & metadata score (0-100)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } }
        },
        responses: { '200': { description: 'Technical SEO audit report' } }
      }
    },
    '/v1/security-audit': {
      post: {
        operationId: 'securityHeadersAudit',
        summary: 'Scan OWASP HTTP security headers & server fingerprint exposure',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } }
        },
        responses: { '200': { description: 'OWASP security headers report' } }
      }
    }
  }
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/' || path === '/health') {
        return jsonResponse({
          service: 'AI Agent MCP & RapidAPI Suite Pro v1.0.0',
          status: 'online',
          endpoints: {
            mcpStreamableHttp: `${url.origin}/mcp`,
            openApiSpec: `${url.origin}/openapi.json`,
            scrape: `${url.origin}/v1/scrape?url=https://example.com`,
            seoAudit: `${url.origin}/v1/seo-audit?url=https://example.com`,
            securityAudit: `${url.origin}/v1/security-audit?url=https://example.com`
          },
          monetization: {
            rapidApiReady: true,
            mcpRegistries: ['Smithery.ai', 'Glama.ai', 'MCP.so'],
            x402UsdcBase: '0x949934c6b9f88f4c55b0b6d11d2f18a088c82f4e'
          }
        });
      }

      if (path === '/openapi.json') {
        return jsonResponse(OPENAPI_SPEC);
      }

      // Model Context Protocol (MCP JSON-RPC 2.0)
      if (path === '/mcp') {
        if (request.method === 'GET') {
          return jsonResponse({
            protocolVersion: '2025-03-26',
            serverInfo: { name: 'ai-agent-mcp-scraper-seo-security-pro', version: '1.0.0' },
            capabilities: { tools: {} },
            tools: MCP_TOOLS
          });
        }
        const body = await request.json();
        const { id, method, params } = body;

        if (method === 'initialize') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2025-03-26',
              serverInfo: { name: 'ai-agent-mcp-scraper-seo-security-pro', version: '1.0.0' },
              capabilities: { tools: {} }
            }
          });
        }

        if (method === 'tools/list') {
          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: { tools: MCP_TOOLS }
          });
        }

        if (method === 'tools/call') {
          const toolName = params?.name;
          const targetUrl = params?.arguments?.url;
          if (!targetUrl) {
            return jsonResponse({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing required argument: url' } }, 400);
          }
          let data;
          if (toolName === 'scrape_clean_markdown') data = await runScrapeTool(targetUrl);
          else if (toolName === 'seo_vitals_audit') data = await runSeoAuditTool(targetUrl);
          else if (toolName === 'security_headers_cve_audit') data = await runSecurityAuditTool(targetUrl);
          else return jsonResponse({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } }, 404);

          return jsonResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            }
          });
        }

        return jsonResponse({ jsonrpc: '2.0', id: id ?? null, result: {} });
      }

      // REST Endpoints (GET ?url=... or POST {"url": "..."})
      let targetUrl = url.searchParams.get('url');
      if (!targetUrl && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        targetUrl = body.url;
      }

      if (path === '/v1/scrape') {
        if (!targetUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);
        return jsonResponse(await runScrapeTool(targetUrl));
      }
      if (path === '/v1/seo-audit') {
        if (!targetUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);
        return jsonResponse(await runSeoAuditTool(targetUrl));
      }
      if (path === '/v1/security-audit') {
        if (!targetUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);
        return jsonResponse(await runSecurityAuditTool(targetUrl));
      }

      return jsonResponse({ error: 'Not Found', docs: `${url.origin}/openapi.json` }, 404);
    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 500);
    }
  }
};
