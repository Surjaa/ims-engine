// Fills the real public address into the built SEO files (canonical, Open Graph, JSON-LD,
// robots.txt, sitemap.xml, llms.txt). Set SITE_URL to your domain before you build:
//   SITE_URL=https://ims.example.com npm run build
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = ['index.html', 'robots.txt', 'sitemap.xml', 'llms.txt'];
const raw = process.env.SITE_URL || 'https://ims-engine.example.com';
const siteUrl = raw.replace(/\/+$/, '');
if (!process.env.SITE_URL) {
  console.warn(`[seo] SITE_URL is not set. Using ${siteUrl}. Set SITE_URL to your real domain before publishing.`);
}
if (!/^https:\/\//.test(siteUrl)) {
  throw new Error(`[seo] SITE_URL must start with https:// (got ${siteUrl})`);
}

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
for (const name of FILES) {
  const path = dist + name;
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  writeFileSync(path, text.replaceAll('__SITE_URL__', siteUrl));
  console.log(`[seo] stamped ${name}`);
}
