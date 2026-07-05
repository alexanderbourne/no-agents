// api/sitemap.js
// Dynamic sitemap covering core routes + every QLD suburb page served by
// api/suburb-page.js. Referenced from the static /sitemap.xml (sitemap index).

import qld from '../data/suburbs-qld.json' with { type: 'json' };

const SITE = 'https://www.no-agents.com.au';
const slugify = n => n.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const slugs = [];
  for (const [regionKey, r] of Object.entries(qld.regions)) {
    for (const name of r.suburbs) {
      let slug = slugify(name);
      if (seen.has(slug)) slug = `${slug}-${regionKey}`;
      if (seen.has(slug)) continue;
      seen.add(slug);
      slugs.push(slug);
    }
  }
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/sell', pri: '0.9' },
    { loc: '/buy', pri: '0.8' },
    { loc: '/fractional', pri: '0.7' },
    { loc: '/for-agents', pri: '0.7' },
    { loc: '/qld-suburbs', pri: '0.9' },
    ...slugs.map(s => ({ loc: `/sell-your-house/${s}`, pri: '0.7' }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(xml);
}
