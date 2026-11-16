'use strict';
// Сборка для Vercel: копирует public/ в dist/ и подставляет адрес сайта в страницы.
const fs = require('fs');
const path = require('path');

let site = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (!site && process.env.VERCEL_PROJECT_PRODUCTION_URL) site = 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
if (!site) site = 'http://localhost:3000';
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site)) {
  console.error('[build] SITE_URL должен быть вида https://domain.by, сейчас: ' + site);
  process.exit(1);
}

const out = path.join(__dirname, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(__dirname, 'public'), out, { recursive: true });
for (const name of ['index', 'privacy']) {
  const html = fs.readFileSync(path.join(__dirname, 'views', name + '.html'), 'utf8').replace(/\{\{SITE_URL\}\}/g, site);
  fs.writeFileSync(path.join(out, name + '.html'), html);
}
const day = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${site}/sitemap.xml\n`);
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${site}/</loc><lastmod>${day}</lastmod><priority>1.0</priority></url>
<url><loc>${site}/privacy</loc><lastmod>${day}</lastmod><priority>0.3</priority></url>
</urlset>
`);
console.log('[build] готово, SITE_URL = ' + site);
