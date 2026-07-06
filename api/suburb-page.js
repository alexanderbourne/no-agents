// api/suburb-page.js
// Server-rendered suburb landing pages for programmatic SEO.
// /sell-your-house            -> hub page (all suburbs, grouped by region)
// /sell-your-house/:slug      -> suburb page (rewritten here with ?slug=)
// Data: data/suburbs-qld.json (all QLD regions) + data/suburbs.json (curated
// per-suburb medians that override the regional default).
// Fully static HTML output, cached at the edge.

import qld from '../data/suburbs-qld.json' with { type: 'json' };
import curated from '../data/suburbs.json' with { type: 'json' };

const SITE = 'https://www.no-agents.com.au';
const NA_COST = 798 + 2 * 99;
const PCT = curated.defaultCommissionPct || 2.5;

const slugify = n => n.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const aud = n => '$' + Math.round(n).toLocaleString('en-AU');

// Build the registry once per cold start
let REG = null;
function registry() {
  if (REG) return REG;
  const bySlug = {};
  const overrides = {};
  for (const s of curated.suburbs || []) overrides[s.slug] = s.median;
  for (const [regionKey, r] of Object.entries(qld.regions)) {
    for (const name of r.suburbs) {
      let slug = slugify(name);
      if (bySlug[slug]) slug = `${slug}-${regionKey}`;
      if (bySlug[slug]) continue;
      bySlug[slug] = { name, slug, regionKey, regionLabel: r.label, median: overrides[slug] || r.median };
    }
  }
  REG = bySlug;
  return REG;
}

const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',system-ui,sans-serif;background:#faf9f6;color:#1a1a1a;font-size:15.5px;line-height:1.65;-webkit-font-smoothing:antialiased}a{color:inherit}.sf{font-family:'Playfair Display',Georgia,serif}.wrap{max-width:860px;margin:0 auto;padding:0 24px}nav{position:sticky;top:0;background:rgba(250,249,246,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e5e0d6;z-index:10}nav .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;font-size:17px}.logo .na{width:34px;height:34px;border-radius:8px;background:#1a1a1a;color:#e8d5b0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}.cta{background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}.hero{text-align:center;padding:64px 24px 48px}.badge{display:inline-block;background:#f5f0e8;border:1px solid #e5e0d6;color:#a07828;font-size:11.5px;font-weight:700;letter-spacing:.08em;padding:6px 14px;border-radius:999px;margin-bottom:20px;text-transform:uppercase}h1{font-size:clamp(30px,5vw,44px);line-height:1.12;font-weight:700;margin-bottom:16px}.sub{color:#4a4540;max-width:620px;margin:0 auto 28px}.btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.btn2{border:1.5px solid #d0c8b8;background:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}section{padding:44px 0}section.alt{background:#fff;border-top:1px solid #e5e0d6;border-bottom:1px solid #e5e0d6}h2{font-size:clamp(22px,3.5vw,30px);margin-bottom:14px}p{margin-bottom:12px;color:#4a4540}table{width:100%;border-collapse:collapse;margin:18px 0;background:#fff;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden}th,td{padding:13px 16px;text-align:left;border-bottom:1px solid #e5e0d6;font-size:14.5px}th{background:#f5f0e8;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;color:#4a4540}tr:last-child td{border-bottom:none}.save{color:#2d7d52;font-weight:700}.steps{display:grid;gap:14px;margin-top:18px}.step{background:#fff;border:1px solid #e5e0d6;border-radius:12px;padding:18px 20px;display:flex;gap:14px;align-items:flex-start}.stepn{background:#1a1a1a;color:#e8d5b0;min-width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}.faq{border-bottom:1px solid #e5e0d6;padding:16px 0}.faq h3{font-size:16px;margin-bottom:6px}.near{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.near a{background:#fff;border:1px solid #e5e0d6;border-radius:999px;padding:8px 16px;font-size:13.5px;text-decoration:none;font-weight:500}.cta-band{background:#1a1a1a;color:#fff;text-align:center;padding:56px 24px}.cta-band h2{color:#fff}.cta-band p{color:rgba(255,255,255,.7)}.cta-band .cta{background:#e8d5b0;color:#1a1a1a;display:inline-block;margin-top:16px}footer{padding:36px 24px;text-align:center;font-size:13px;color:#8a8078}footer a{color:#8a8078;text-decoration:none;margin:0 8px}.note{font-size:12.5px;color:#8a8078;margin-top:8px}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function head(title, desc, path, ld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="no-agents">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/no-agents-hero.jpg">
<meta property="og:locale" content="en_AU">
<meta name="geo.region" content="AU-QLD">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231a1a1a'/><text x='16' y='22' font-size='14' text-anchor='middle' fill='%23e8d5b0' font-family='Georgia,serif' font-weight='700'>na</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${CSS}</style>
</head>`;
}

const NAV = `<nav><div class="wrap"><a class="logo sf" href="/"><span class="na">na</span>no-agents</a><a class="cta" href="/sell">List for $798</a></div></nav>`;
const FOOTER = `<footer>© 2026 No Agents Pty Ltd · ABN 18 642 813 438 · Licence 4542501 QLD<br><a href="/">Home</a>·<a href="/sell">Sell</a>·<a href="/buy">Buy</a>·<a href="/for-agents">For agents</a>·<a href="/qld-suburbs">All suburbs</a></footer>`;

// Copy variants keyed by slug hash — keeps pages from being carbon copies
const INTROS = [
  (s, c) => `On a typical home in ${s.name}, a traditional agent's ${PCT}% commission runs to about <strong>${aud(c)}</strong> — before marketing extras. With no-agents you pay <strong>$798 flat</strong> and keep the difference.`,
  (s, c) => `Selling in ${s.name}? At the usual ${PCT}% rate, agent commission on a local home is roughly <strong>${aud(c)}</strong>. Our flat fee is <strong>$798</strong> — the rest stays in your pocket.`,
  (s, c) => `${s.name} sellers typically hand over about <strong>${aud(c)}</strong> in commission at ${PCT}%. There's another way: <strong>$798 flat</strong>, everything included, no commission ever.`
];

function suburbPage(s) {
  const commission = s.median * (PCT / 100);
  const saving = commission - NA_COST;
  const path = `/sell-your-house/${s.slug}`;
  const title = `Sell your house in ${s.name} without an agent — keep ~${aud(saving)} | no-agents`;
  const desc = `Sell your ${s.name} home for a $798 flat fee instead of ~${aud(commission)} in agent commission. Domain.com.au listing, photography and 3D tour included. Licensed QLD agency.`;
  const reg = registry();
  const siblings = Object.values(reg).filter(x => x.regionKey === s.regionKey && x.slug !== s.slug);
  const start = hash(s.slug) % Math.max(1, siblings.length);
  const near = [];
  for (let i = 0; i < Math.min(6, siblings.length); i++) near.push(siblings[(start + i) % siblings.length]);
  const intro = INTROS[hash(s.slug) % INTROS.length](s, commission);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Sell your house in Queensland', item: SITE + '/qld-suburbs' },
        { '@type': 'ListItem', position: 3, name: s.name, item: SITE + path }
      ]},
      { '@type': 'Service', name: `Flat-fee property sales in ${s.name}`, serviceType: 'Real estate sales',
        areaServed: { '@type': 'Place', name: `${s.name}, Queensland` },
        provider: { '@type': 'RealEstateAgent', name: 'No Agents', url: SITE, telephone: '+61485043210' },
        offers: { '@type': 'Offer', price: '798', priceCurrency: 'AUD' } },
      { '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: `How much does it cost to sell a house in ${s.name} with no-agents?`,
          acceptedAnswer: { '@type': 'Answer', text: `A flat $798 covers your Domain.com.au listing, professional photography, floor plans and 3D virtual tour. Optional licensed-agent inspection visits are $99 each. There is no commission at any sale price.` } },
        { '@type': 'Question', name: `How much commission would a traditional agent charge in ${s.name}?`,
          acceptedAnswer: { '@type': 'Answer', text: `At a typical ${PCT}% rate on a home around ${aud(s.median)} in ${s.regionLabel}, commission alone is roughly ${aud(commission)} — before marketing and auctioneer costs. With no-agents you keep that difference.` } },
        { '@type': 'Question', name: 'Is this a licensed agency?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes. No Agents Pty Ltd holds Queensland real estate licence 4542501, so your sale runs through a licensed agency while you keep the commission.' } }
      ]}
    ]
  };

  return `${head(title, desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">${esc(s.name)} · ${esc(s.regionLabel)}</span>
<h1 class="sf">Sell your house in ${esc(s.name)}.<br>Keep the commission.</h1>
<p class="sub">${intro}</p>
<div class="btns"><a class="cta" href="/sell">List my ${esc(s.name)} property →</a><a class="btn2" href="/buy">View listings</a></div>
</div>
<section class="alt"><div class="wrap">
<h2 class="sf">What selling in ${esc(s.name)} actually costs</h2>
<table>
<tr><th></th><th>Traditional agent</th><th>no-agents</th></tr>
<tr><td>Fee on a ~${aud(s.median)} home*</td><td>~${aud(commission)} (${PCT}%)</td><td>$798 flat</td></tr>
<tr><td>Marketing (VPA)</td><td>$3,000–$8,000 extra</td><td>$0 — included</td></tr>
<tr><td>Photography &amp; 3D tour</td><td>Often extra</td><td>$0 — included</td></tr>
<tr><td>Inspections</td><td>Included in commission</td><td>$99/visit or free self-managed</td></tr>
<tr><td><strong>You keep</strong></td><td>—</td><td class="save">~${aud(saving)} more</td></tr>
</table>
<p class="note">*Based on an indicative median house price of ${aud(s.median)} for ${esc(s.regionLabel)} and a ${PCT}% commission. Your price and an agent's rate will vary — the flat fee doesn't.</p>
</div></section>
<section><div class="wrap">
<h2 class="sf">How it works in ${esc(s.name)}</h2>
<div class="steps">
<div class="step"><span class="stepn">1</span><div><strong>List for $798.</strong> About 10 minutes online. We create the listing, publish to Domain.com.au and arrange professional photography and a 3D tour of your ${esc(s.name)} property.</div></div>
<div class="step"><span class="stepn">2</span><div><strong>We manage everything.</strong> Enquiries, inspection bookings and offers run through the platform. Meet buyers yourself for free, or a licensed agent attends for $99 a visit.</div></div>
<div class="step"><span class="stepn">3</span><div><strong>Accept your best offer.</strong> Every verified offer sits on an open offer board all buyers can see — auction-style competition, online and always on.</div></div>
</div>
</div></section>
<section class="alt"><div class="wrap">
<h2 class="sf">Common questions — selling in ${esc(s.name)}</h2>
<div class="faq"><h3>How much does it cost?</h3><p>$798 flat, including the Domain.com.au portal fee, photography, floor plans and 3D tour. Optional $99 licensed-agent visits. No commission at any sale price.</p></div>
<div class="faq"><h3>How much would an agent charge?</h3><p>Around ${PCT}% — roughly ${aud(commission)} on a typical home in ${esc(s.regionLabel)}, plus marketing. That money stays with you instead.</p></div>
<div class="faq"><h3>Is it legal to sell this way?</h3><p>Yes. No Agents Pty Ltd is a licensed Queensland agency (licence 4542501). Contracts go through your conveyancer, exactly as with any agent.</p></div>
<div class="faq"><h3>Who shows buyers through?</h3><p>Your choice: meet buyers yourself for free, or hand over a spare key and a licensed agent opens up, shows through and locks up for $99 a visit.</p></div>
</div></section>
<section><div class="wrap">
<h2 class="sf">Also selling in ${esc(s.regionLabel)}</h2>
<div class="near">${near.map(n => `<a href="/sell-your-house/${n.slug}">${esc(n.name)}</a>`).join('')}<a href="/qld-suburbs">All QLD suburbs →</a></div>
</div></section>
<div class="cta-band">
<h2 class="sf">Ready to keep your ~${aud(saving)}?</h2>
<p>$798 flat fee · No commission · Everything included</p>
<a class="cta" href="/sell">List my property →</a>
</div>
${FOOTER}
</body></html>`;
}

function hubPage() {
  const path = '/qld-suburbs';
  const title = 'Sell your house without an agent in Queensland — every suburb | no-agents';
  const desc = 'Flat-fee $798 property sales across Queensland. See what agent commission costs in your suburb and how much you keep selling with no-agents.';
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: SITE + path,
    about: { '@type': 'RealEstateAgent', name: 'No Agents', url: SITE } };
  const reg = registry();
  const groups = {};
  for (const s of Object.values(reg)) (groups[s.regionKey] ||= { label: s.regionLabel, items: [] }).items.push(s);
  const list = Object.values(groups).map(g =>
    `<h2 class="sf" style="margin-top:28px;font-size:20px;text-transform:capitalize">${esc(g.label)}</h2><div class="near">` +
    g.items.map(s => `<a href="/sell-your-house/${s.slug}">${esc(s.name)}</a>`).join('') + '</div>').join('');
  return `${head(title, desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">Queensland · Licensed agency · Lic. 4542501</span>
<h1 class="sf">Sell without an agent,<br>suburb by suburb.</h1>
<p class="sub">One flat fee — $798 — wherever you are in Queensland. Pick your suburb to see what a traditional agent's commission would cost you, and what you keep instead.</p>
<div class="btns"><a class="cta" href="/sell">List my property →</a></div>
</div>
<section class="alt"><div class="wrap">${list}</div></section>
<div class="cta-band">
<h2 class="sf">Same fee, every suburb.</h2>
<p>$798 flat · Domain.com.au listing · Photography &amp; 3D tour included</p>
<a class="cta" href="/sell">Start selling →</a>
</div>
${FOOTER}
</body></html>`;
}

export default function handler(req, res) {
  const slug = (req.query.slug || '').toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  if (!slug) return res.status(200).send(hubPage());
  const s = registry()[slug];
  if (!s) {
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.status(404).send(`<!DOCTYPE html><html><head><title>Suburb not found</title><meta name="robots" content="noindex"></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>We couldn't find that suburb</h1><p><a href="/qld-suburbs">Browse all Queensland suburbs</a></p></body></html>`);
  }
  return res.status(200).send(suburbPage(s));
}
