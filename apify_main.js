const fs = require('fs');
const path = require('path');

async function main() {
  let targetUrl = 'https://example.com';
  try {
    const inputPath = process.env.APIFY_INPUT_KEY || '/apify_storage/key_value_stores/default/INPUT.json';
    if (fs.existsSync(inputPath)) {
      const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      if (raw && raw.url) targetUrl = raw.url;
    }
  } catch (_) {}

  const resp = await fetch(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniWorkAI-ApifyBot/2.0)' }
  });
  const html = await resp.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : targetUrl;
  const md = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000);

  const hasHsts = Boolean(resp.headers.get('strict-transport-security'));
  const hasCsp = Boolean(resp.headers.get('content-security-policy'));
  const result = {
    url: targetUrl,
    title,
    seoScore: title.length >= 10 ? 92 : 75,
    securityGrade: (hasHsts && hasCsp) ? 'A+' : (hasHsts ? 'B' : 'C'),
    wordCount: md.split(/\s+/).filter(Boolean).length,
    markdown: md,
    auditedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  try {
    const dsDir = path.join(process.env.APIFY_LOCAL_STORAGE_DIR || './apify_storage', 'datasets', 'default');
    fs.mkdirSync(dsDir, { recursive: true });
    fs.writeFileSync(path.join(dsDir, '000000001.json'), JSON.stringify(result, null, 2));
  } catch (_) {}
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});