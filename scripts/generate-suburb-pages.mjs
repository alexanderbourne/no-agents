#!/usr/bin/env node
/**
 * Programmatic SEO: generates static suburb landing pages + sitemap.xml
 * Usage: node scripts/generate-suburb-pages.mjs
 * Output: /sell-your-house/<slug>.html (served as /sell-your-house/<slug> via cleanUrls)
 *         /sell-your-house/index.html  (hub page)
 *         /sitemap.xml
 * Data:   /data/suburbs.json  — edit medians there, re-run, redeploy.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.no-agents.com.au';
const { suburbs, defaultCommissionPct } = JSON.parse(readFileSync(join(root, 'data', 'suburbs.json'), 'utf8'));

const aud = n => '$' + Math.round(n).toLocaleString('en-AU');
const bySlug = Object.fromEntries(suburbs.map(s => [s.slug, s]));

const NA_COST = 798 + 2 * 99; // package + 2 typical agent visits

const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#faf9f6;color:#1a1a1a;font-size:15.5px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
.sf{font-family:'Playfair Display',Georgia,serif}
.wrap{max-width:860px;margin:0 auto;padding:0 24px}
nav{position:sticky;top:0;background:rgba(250,249,246,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e5e0d6;z-index:10}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;font-size:17px}
.logo .na{width:34px;height:34px;border-radius:8px;background:#1a1a1a;color:#e8d5b0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.cta{background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}
.hero{text-align:center;padding:64px 24px 48px}
.badge{display:inline-block;background:#f5f0e8;border:1px solid #e5e0d6;color:#a07828;font-size:11.5px;font-weight:700;letter-spacing:.08em;padding:6px 14px;border-radius:999px;margin-bottom:20px;text-transform:uppercase}
h1{font-size:clamp(30px,5vw,44px);line-height:1.12;font-weight:700;margin-bottom:16px}
.sub{color:#4a4540;max-width:620px;margin:0 auto 28px}
.btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn2{border:1.5px solid #d0c8b8;background:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}
section{padding:44px 0}
section.alt{background:#fff;border-top:1px solid #e5e0d6;border-bottom:1px solid #e5e0d6}
h2{font-size:clamp(22px,3.5vw,30px);margin-bottom:14px}
p{margin-bottom:12px;color:#4a4540}
table{width:100%;border-collapse:collapse;margin:18px 0;background:#fff;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden}
th,td{padding:13px 16px;text-align:left;border-bottom:1px solid #e5e0d6;font-size:14.5px}
th{background:#f5f0e8;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;color:#4a4540}
tr:last-child td{border-bottom:none}
.save{color:#2d7d52;font-weight:700}
.steps{display:grid;gap:14px;margin-top:18px}
.step{background:#fff;border:1px solid #e5e0d6;border-radius:12px;padding:18px 20px;display:flex;gap:14px;align-items:flex-start}
.stepn{background:#1a1a1a;color:#e8d5b0;min-width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.faq{border-bottom:1px solid #e5e0d6;padding:16px 0}
.faq h3{font-size:16px;margin-bottom:6px}
.near{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.near a{background:#fff;border:1px solid #e5e0d6;border-radius:999px;padding:8px 16px;font-size:13.5px;text-decoration:none;font-weight:500}
.cta-band{background:#1a1a1a;color:#fff;text-align:center;padding:56px 24px}
.cta-band h2{color:#fff}
.cta-band p{color:rgba(255,255,255,.7)}
.cta-band .cta{background:#e8d5b0;color:#1a1a1a;display:inline-block;margin-top:16px}
footer{padding:36px 24px;text-align:center;font-size:13px;color:#8a8078}
footer a{color:#8a8078;text-decoration:none;margin:0 8px}
.note{font-size:12.5px;color:#8a8078;margin-top:8px}
`;

function head(title, desc, path, ld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="no-agents">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/no-agents-hero.jpg">
<meta property="og:locale" content="en_AU">
<meta name="geo.region" content="AU-QLD">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231a1a1a'/><text x='16' y='22' font-size='14' text-anchor='middle' fill='%23e8d5b0' font-family='Georgia,serif' font-weight='700'>na</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${css}</style>
</head>`;
}

const navHtml = `<nav><div class="wrap">
<a class="logo sf" href="/"><span class="na">na</span>no-agents</a>
<a class="cta" href="/sell">List for $798</a>
</div></nav>`;

const footerHtml = `<footer>
© 2026 No Agents Pty Ltd · ABN 18 642 813 438 · Licence 4542501 QLD<br>
<a href="/">Home</a>·<a href="/sell">Sell</a>·<a href="/buy">Buy</a>·<a href="/for-agents">For agents</a>·<a href="/sell-your-house">All suburbs</a>
</footer>`;

function suburbPage(s) {
  const pct = s.commissionPct || defaultCommissionPct;
  const commission = s.median * (pct / 100);
  const saving = commission - NA_COST;
  const path = `/sell-your-house/${s.slug}`;
  const title = `Sell your house in ${s.name} without an agent — keep ~${aud(saving)} | no-agents`;
  const desc = `Sell your ${s.name} home for a $798 flat fee instead of ~${aud(commission)} in agent commission. Domain.com.au listing, photography and 3D tour included. Licensed QLD agency.`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Sell your house', item: SITE + '/sell-your-house' },
        { '@type': 'ListItem', position: 3, name: s.name, item: SITE + path }
      ]},
      { '@type': 'Service', name: `Flat-fee property sales in ${s.name}`, serviceType: 'Real estate sales',
        areaServed: { '@type': 'Place', name: `${s.name}, Brisbane QLD` },
        provider: { '@type': 'RealEstateAgent', name: 'No Agents', url: SITE, telephone: '+61485043210' },
        offers: { '@type': 'Offer', price: '798', priceCurrency: 'AUD' } },
      { '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: `How much does it cost to sell a house in ${s.name} with no-agents?`,
          acceptedAnswer: { '@type': 'Answer', text: `A flat $798 covers your Domain.com.au listing, professional photography, floor plans and 3D virtual tour. Optional licensed-agent inspection visits are $99 each. There is no commission at any sale price.` } },
        { '@type': 'Question', name: `How much commission would a traditional agent charge in ${s.name}?`,
          acceptedAnswer: { '@type': 'Answer', text: `At a typical ${pct}% rate on a home around ${aud(s.median)}, commission alone is roughly ${aud(commission)} — before marketing and auctioneer costs. With no-agents you keep that difference.` } },
        { '@type': 'Question', name: 'Is this a licensed agency?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes. No Agents Pty Ltd holds Queensland real estate licence 4542501, so your sale runs through a licensed agency while you keep the commission.' } }
      ]}
    ]
  };

  const nearLinks = (s.near || []).filter(n => bySlug[n]).map(n =>
    `<a href="/sell-your-house/${n}">${bySlug[n].name}</a>`).join('');

  return `${head(title, desc, path, ld)}
<body>
${navHtml}
<div class="hero">
<span class="badge">${s.name} · Brisbane ${s.region}</span>
<h1 class="sf">Sell your house in ${s.name}.<br>Keep the commission.</h1>
<p class="sub">On a typical ${s.name} home, a traditional agent's ${pct}% commission is about <strong>${aud(commission)}</strong>. With no-agents you pay <strong>$798 flat</strong> — and keep the rest.</p>
<div class="btns"><a class="cta" href="/sell">List my ${s.name} property →</a><a class="btn2" href="/buy">View listings</a></div>
</div>

<section class="alt"><div class="wrap">
<h2 class="sf">What selling in ${s.name} actually costs</h2>
<table>
<tr><th></th><th>Traditional agent</th><th>no-agents</th></tr>
<tr><td>Fee on a ~${aud(s.median)} home*</td><td>~${aud(commission)} (${pct}%)</td><td>$798 flat</td></tr>
<tr><td>Marketing (VPA)</td><td>$3,000–$8,000 extra</td><td>$0 — included</td></tr>
<tr><td>Photography &amp; 3D tour</td><td>Often extra</td><td>$0 — included</td></tr>
<tr><td>Inspections</td><td>Included in commission</td><td>$99/visit or free self-managed</td></tr>
<tr><td><strong>You keep</strong></td><td>—</td><td class="save">~${aud(saving)} more</td></tr>
</table>
<p class="note">*Based on an indicative ${s.name} median house price of ${aud(s.median)} and a ${pct}% commission. Your price and an agent's rate will vary — the flat fee doesn't.</p>
</div></section>

<section><div class="wrap">
<h2 class="sf">How it works in ${s.name}</h2>
<div class="steps">
<div class="step"><span class="stepn">1</span><div><strong>List for $798.</strong> About 10 minutes online. We create the listing, publish to Domain.com.au and arrange professional photography and a 3D tour of your ${s.name} property.</div></div>
<div class="step"><span class="stepn">2</span><div><strong>We manage everything.</strong> Enquiries, inspection bookings and offers run through the platform. Meet buyers yourself for free, or a licensed agent attends for $99 a visit.</div></div>
<div class="step"><span class="stepn">3</span><div><strong>Accept your best offer.</strong> Every verified offer sits on an open offer board all buyers can see — auction-style competition, online and always on.</div></div>
</div>
</div></section>

<section class="alt"><div class="wrap">
<h2 class="sf">Common questions — selling in ${s.name}</h2>
<div class="faq"><h3>How much does it cost?</h3><p>$798 flat, including the Domain.com.au portal fee, photography, floor plans and 3D tour. Optional $99 licensed-agent visits. No commission at any sale price.</p></div>
<div class="faq"><h3>How much would an agent charge?</h3><p>Around ${pct}% in ${s.name} — roughly ${aud(commission)} on a median home, plus marketing. That money stays with you instead.</p></div>
<div class="faq"><h3>Is it legal to sell this way?</h3><p>Yes. No Agents Pty Ltd is a licensed Queensland agency (licence 4542501). Contracts go through your conveyancer, exactly as with any agent.</p></div>
<div class="faq"><h3>Who shows buyers through?</h3><p>Your choice: meet buyers yourself for free, or hand over a spare key and a licensed agent opens up, shows through and locks up for $99 a visit.</p></div>
</div></section>

<section><div class="wrap">
<h2 class="sf">Also selling nearby</h2>
<div class="near">${nearLinks}<a href="/sell-your-house">All Brisbane suburbs →</a></div>
</div></section>

<div class="cta-band">
<h2 class="sf">Ready to keep your ~${aud(saving)}?</h2>
<p>$798 flat fee · No commission · Everything included</p>
<a class="cta" href="/sell">List my property →</a>
</div>
${footerHtml}
</body></html>`;
}

function hubPage() {
  const path = '/sell-your-house';
  const title = 'Sell your house without an agent in Brisbane — suburb guide | no-agents';
  const desc = 'Flat-fee $798 property sales across Brisbane. See what agent commission costs in your suburb and how much you keep selling with no-agents.';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage', name: title, url: SITE + path,
    about: { '@type': 'RealEstateAgent', name: 'No Agents', url: SITE }
  };
  const groups = {};
  for (const s of suburbs) (groups[s.region] ||= []).push(s);
  const list = Object.entries(groups).map(([region, subs]) =>
    `<h2 class="sf" style="margin-top:28px;font-size:20px;text-transform:capitalize">${region}</h2><div class="near">` +
    subs.map(s => `<a href="/sell-your-house/${s.slug}">${s.name}</a>`).join('') + '</div>').join('');
  return `${head(title, desc, path, ld)}
<body>
${navHtml}
<div class="hero">
<span class="badge">Brisbane · Licensed agency · Lic. 4542501</span>
<h1 class="sf">Sell without an agent,<br>suburb by suburb.</h1>
<p class="sub">One flat fee — $798 — wherever you are in Brisbane. Pick your suburb to see what a traditional agent's commission would cost you, and what you keep instead.</p>
<div class="btns"><a class="cta" href="/sell">List my property →</a></div>
</div>
<section class="alt"><div class="wrap">${list}</div></section>
<div class="cta-band">
<h2 class="sf">Same fee, every suburb.</h2>
<p>$798 flat · Domain.com.au listing · Photography &amp; 3D tour included</p>
<a class="cta" href="/sell">Start selling →</a>
</div>
${footerHtml}
</body></html>`;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/sell', pri: '0.9' },
    { loc: '/buy', pri: '0.8' },
    { loc: '/fractional', pri: '0.7' },
    { loc: '/for-agents', pri: '0.7' },
    { loc: '/sell-your-house', pri: '0.9' },
    ...suburbs.map(s => ({ loc: `/sell-your-house/${s.slug}`, pri: '0.8' }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
}

// ── run ──
const outDir = join(root, 'sell-your-house');
mkdirSync(outDir, { recursive: true });
for (const s of suburbs) writeFileSync(join(outDir, `${s.slug}.html`), suburbPage(s));
writeFileSync(join(outDir, 'index.html'), hubPage());
writeFileSync(join(root, 'sitemap.xml'), sitemap());
console.log(`Generated ${suburbs.length} suburb pages + hub + sitemap.xml`);
