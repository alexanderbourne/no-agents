// api/guides.js
// Long-form informational content for long-tail, top-of-funnel search queries
// ("how to sell privately in Queensland") that the suburb pages don't target —
// people who aren't ready to search "sell my house Brisbane" yet. Same
// serverless-SSR pattern as api/suburb-page.js.
//
// /guides            -> hub page (all articles)
// /guides/:slug       -> article (rewritten here with ?slug=)

const SITE = 'https://www.no-agents.com.au';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',system-ui,sans-serif;background:#faf9f6;color:#1a1a1a;font-size:15.5px;line-height:1.7;-webkit-font-smoothing:antialiased}a{color:#a07828}.sf{font-family:'Playfair Display',Georgia,serif}.wrap{max-width:760px;margin:0 auto;padding:0 24px}nav{position:sticky;top:0;background:rgba(250,249,246,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e5e0d6;z-index:10}nav .wrap{max-width:860px;display:flex;align-items:center;justify-content:space-between;height:60px}.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;font-size:17px;color:#1a1a1a}.logo .na{width:34px;height:34px;border-radius:8px;background:#1a1a1a;color:#e8d5b0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}.cta{background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}.hero{text-align:center;padding:56px 24px 40px}.badge{display:inline-block;background:#f5f0e8;border:1px solid #e5e0d6;color:#a07828;font-size:11.5px;font-weight:700;letter-spacing:.08em;padding:6px 14px;border-radius:999px;margin-bottom:20px;text-transform:uppercase}h1{font-size:clamp(28px,4.5vw,40px);line-height:1.15;font-weight:700;margin-bottom:14px}.sub{color:#4a4540;max-width:620px;margin:0 auto}section{padding:36px 0}article h2{font-size:22px;margin:32px 0 12px;font-weight:700}article h3{font-size:18px;margin:22px 0 8px;font-weight:600}article p{margin-bottom:14px;color:#2a2620}article ul,article ol{margin:0 0 14px 22px;color:#2a2620}article li{margin-bottom:6px}.callout{background:#fff;border:1px solid #e5e0d6;border-left:4px solid #1a1a1a;border-radius:8px;padding:16px 20px;margin:20px 0}.meta{color:#8a8078;font-size:13.5px;margin-bottom:28px}.card{background:#fff;border:1px solid #e5e0d6;border-radius:12px;padding:20px;margin-bottom:14px;text-decoration:none;display:block;color:inherit}.card h3{margin:0 0 6px}.card p{margin:0;color:#4a4540;font-size:14px}.cta-band{background:#1a1a1a;color:#fff;text-align:center;padding:48px 24px;margin-top:40px}.cta-band h2{color:#fff}.cta-band p{color:rgba(255,255,255,.7);margin-bottom:16px}.cta-band .cta{background:#e8d5b0;color:#1a1a1a;display:inline-block}footer{padding:36px 24px;text-align:center;font-size:13px;color:#8a8078}footer a{color:#8a8078;text-decoration:none;margin:0 8px}`;

const NAV = `<nav><div class="wrap"><a class="logo sf" href="/"><span class="na">na</span>no-agents</a><a class="cta" href="/sell">List for $798</a></div></nav>`;
const FOOTER = `<footer>© 2026 No Agents Pty Ltd · ABN 18 642 813 438 · Licence 4542501 QLD<br><a href="/">Home</a>·<a href="/sell">Sell</a>·<a href="/guides">Guides</a>·<a href="/qld-suburbs">All suburbs</a></footer>`;

function head(title, desc, path, ld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="no-agents">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta name="geo.region" content="AU-QLD">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${CSS}</style>
</head>`;
}

const GUIDES = [
  {
    slug: 'how-to-sell-your-house-privately-in-queensland',
    title: 'How to Sell Your House Privately in Queensland: A Complete Guide',
    desc: 'A step-by-step guide to selling your own home in Queensland without a real estate agent — legally, safely, and without paying commission.',
    published: '2026-06-15',
    summary: 'What FSBO actually involves in QLD, step by step — and where the process still needs a licensed agency behind it.',
    body: `
<p>Selling a house without a real estate agent — often called "for sale by owner" or FSBO — is completely legal in Queensland, provided the sale still runs through a licensed real estate agency for the parts of the process the law requires it for. Here's exactly how the process works, from the day you decide to sell to the day you hand over the keys.</p>

<h2>1. Get your property genuinely market-ready</h2>
<p>Before anything goes live, you need accurate details: address, land size, floor area, number of bedrooms/bathrooms/car spaces, and an honest description of condition and features. Buyers verify this against public records and their own inspection, so accuracy matters more than polish.</p>

<h2>2. List on a major portal, not just word of mouth</h2>
<p>The overwhelming majority of Queensland property buyers search on Domain.com.au or realestate.com.au before anywhere else. A private listing that only exists on a noticeboard or a Facebook group will structurally underperform one on a major portal — this is the single biggest reason FSBO sellers historically struggled, not the absence of an agent.</p>

<h2>3. Professional photography and a floor plan</h2>
<p>Listings with professional photography and a floor plan consistently attract more serious enquiries than phone-camera photos. A 3D virtual tour lets interstate or overseas buyers shortlist your property before booking an inspection, which matters more than ever given how much of the buyer search process now happens before a single physical inspection.</p>

<h2>4. Manage enquiries and inspections</h2>
<p>Every enquiry should be logged and followed up quickly — buyers moving through multiple listings will simply move on if a seller is slow to respond. For inspections, you can meet buyers yourself, or engage a licensed agent to attend on your behalf for a per-visit fee, which matters especially if you work standard business hours or the property is tenanted.</p>

<h2>5. Take and compare offers</h2>
<p>An offer is an expression of interest, not a binding contract. Compare offers on price, deposit, settlement timeframe, and any conditions (finance, building & pest) — a higher headline price with a shaky finance condition can be worth less than a lower, cleaner offer.</p>

<h2>6. The Heads of Agreement and the formal Contract of Sale</h2>
<p>Once you accept an offer, the agreed terms are typically documented first as a Heads of Agreement — a summary both parties sign to confirm the deal before the formal, legally binding Contract of Sale is prepared. The Contract of Sale itself must be prepared by a licensed conveyancer or solicitor; this step doesn't change whether you sold through an agent or privately.</p>

<h2>7. Conditions, cooling-off, and settlement</h2>
<p>Most residential contracts in Queensland include a statutory cooling-off period for the buyer, plus any negotiated conditions like finance approval or a building & pest inspection. Settlement — the day money and title actually change hands — typically follows 30 to 90 days after the contract becomes unconditional, depending on what was agreed.</p>

<h2>Why this still needs a licensed agency</h2>
<p>Queensland's Property Occupations Act 2014 regulates who can market and sell residential property for a fee — this is why "FSBO" platforms in Queensland operate as licensed real estate agencies themselves (charging a flat fee instead of a percentage commission), rather than being a way to bypass the licensing requirement entirely. The saving comes from the fee structure, not from skipping the legal framework.</p>

<div class="callout"><strong>The short version:</strong> the legal and process steps are identical to a traditional sale — what changes is who does the marketing legwork, and what you pay for it.</div>
`,
  },
  {
    slug: 'fsbo-vs-real-estate-agent-commission-cost',
    title: 'FSBO vs Real Estate Agent: What Commission Actually Costs You',
    desc: 'A real breakdown of what a traditional real estate agent commission costs on a Queensland home sale, and where that money actually goes.',
    published: '2026-06-18',
    summary: 'The actual maths behind agent commission on a Queensland sale, broken into what you’re paying for.',
    body: `
<p>Real estate commission in Queensland is typically charged as a percentage of the final sale price, commonly in the 2% to 3% range depending on the agency and region, plus GST. On top of that percentage, most agency agreements also pass through a separate marketing budget (often called a VPA — vendor-paid advertisement) and, for auction campaigns, an auctioneer's fee.</p>

<h2>Worked example</h2>
<p>Take a home selling for $720,000 at a 2.75% commission rate:</p>
<ul>
<li><strong>Commission:</strong> approximately $19,800</li>
<li><strong>Marketing/VPA:</strong> commonly $3,000&ndash;$8,000, charged regardless of whether the property sells</li>
<li><strong>Auctioneer's fee (if applicable):</strong> commonly $400&ndash;$800</li>
</ul>
<p>Total cost to the seller: often $23,000&ndash;$29,000 on a $720,000 sale — before GST is added to the commission component.</p>

<h2>What that fee is actually paying for</h2>
<p>Commission compensates an agency for marketing, negotiation, buyer qualification, inspection management, and administration through to settlement. None of that work disappears under a flat-fee model — it's simply priced differently: a fixed fee rather than a fee that scales with the sale price.</p>

<h2>Why percentage-based commission scales oddly</h2>
<p>The actual marketing and administrative work involved in selling a $500,000 unit and a $1.5 million house is broadly similar — the portal listing, the photography shoot, and the inspection process don't triple in effort because the price triples. A percentage fee means the price of the service scales with the property's value rather than with the actual work involved, which is the core argument for a flat-fee alternative.</p>

<h2>What a flat-fee model changes — and doesn't</h2>
<p>A flat-fee listing (commonly a few hundred to under $1,000, all-inclusive) still requires the property to be listed by a licensed agency, still runs through the same contract and conveyancing process, and still involves genuine marketing and buyer management. What changes is that the fee is fixed regardless of the sale price, so a seller of a $1.5 million property doesn't pay proportionally more for essentially the same service as a seller of a $500,000 property.</p>

<h2>Where the real trade-off is</h2>
<p>The honest trade-off with a flat-fee model isn't legal risk — it's that you (the seller) typically do more of the day-to-day coordination yourself, or pay per-visit for a licensed agent to attend inspections, rather than having one person manage the entire campaign end-to-end by default. For sellers comfortable with some hands-on involvement, that trade clearly favours the flat fee. For sellers who want to be fully hands-off from day one, it's a genuine consideration.</p>

<div class="callout">Use a commission calculator against your own suburb's median price before assuming either model is automatically cheaper for your situation — the gap widens significantly at higher price points.</div>
`,
  },
  {
    slug: 'building-and-pest-inspections-selling-without-an-agent',
    title: 'Building & Pest Inspections When Selling Without an Agent',
    desc: 'How building and pest inspection conditions work in a Queensland property sale, and what sellers need to know when managing the process themselves.',
    published: '2026-06-22',
    summary: 'What a B&P condition actually means for a seller, and how the clearance process typically runs.',
    body: `
<p>A building and pest (B&amp;P) inspection condition is one of the most common conditions attached to a residential offer in Queensland. Understanding how it works matters whether you're selling with an agent or managing the process yourself.</p>

<h2>What a B&P condition actually is</h2>
<p>When a buyer submits an offer "subject to building and pest," they're asking for a window of time (commonly 7&ndash;14 days from contract signing) to have a licensed inspector assess the property's structural condition and check for termite or pest activity, before their purchase becomes unconditional. If the report reveals a significant issue, the buyer typically has the right to negotiate a price reduction, request repairs, or in some cases withdraw from the contract.</p>

<h2>Who arranges the inspection</h2>
<p>The buyer engages and pays for the building and pest inspector — this is standard regardless of whether the seller used an agent or sold privately. The seller's role is to provide reasonable access to the property for the inspection to take place within the agreed condition period.</p>

<h2>What sellers should do before listing</h2>
<p>Some sellers choose to commission their own pre-sale building and pest report before the property even goes to market. This can surface issues early (so they can be disclosed or addressed upfront) and can reduce the chance of a buyer's report derailing negotiations late in the process — though it isn't a legal requirement.</p>

<h2>Managing access without an agent</h2>
<p>If you're managing your own inspections, coordinate directly with the buyer's inspector on timing, and be upfront about property access (keys, alarm codes, pets). Sellers using a licensed inspection-panel agent for buyer walkthroughs can extend the same arrangement to a B&amp;P inspector's visit if they'd rather not attend in person themselves.</p>

<h2>If the report raises an issue</h2>
<p>Most B&amp;P conditions give the buyer a defined window to raise concerns in writing. From there, it's a negotiation like any other — a price adjustment, an agreed repair, or in some cases the buyer exercising their right to terminate under the condition. None of this requires a real estate agent to facilitate; it's a conversation between seller and buyer (often via their respective conveyancers once the matter is more than a minor adjustment).</p>

<h2>Finding a licensed inspector</h2>
<p>Building and pest inspectors must be licensed in Queensland. A quick search for licensed inspectors in your specific suburb, sorted by review rating, is generally the most transparent way to find a reputable local operator — rather than relying on a single recommended provider who may not actually service your area.</p>

<div class="callout">The B&P condition period is usually the tightest deadline in the whole transaction — track it closely, since missing it can affect either party's rights under the contract.</div>
`,
  },
  {
    slug: 'heads-of-agreement-explained-queensland',
    title: 'What Is a Heads of Agreement? The QLD Property Contract Process Explained',
    desc: 'Understanding the Heads of Agreement stage of a Queensland property sale, how it differs from the formal Contract of Sale, and what happens next.',
    published: '2026-06-25',
    summary: 'How the Heads of Agreement stage fits between an accepted offer and the binding Contract of Sale.',
    body: `
<p>Once a seller accepts a buyer's offer on a Queensland property, there's a step that often causes confusion: the Heads of Agreement. It isn't the final contract, but it isn't nothing either — here's exactly what it is and how it fits into the process.</p>

<h2>What a Heads of Agreement actually is</h2>
<p>A Heads of Agreement is a written summary of the terms both parties have agreed to — purchase price, deposit, settlement period, and any conditions like finance or building &amp; pest — signed by buyer and seller to confirm the deal before the formal Contract of Sale is drawn up. Think of it as documenting "we agree on these terms," rather than the legally binding sale document itself.</p>

<h2>Why it exists as a separate step</h2>
<p>The formal Contract of Sale is a detailed legal document that a licensed conveyancer or solicitor prepares, incorporating standard clauses, title details, and any special conditions correctly drafted in enforceable legal language. That takes time to prepare properly. The Heads of Agreement lets both parties lock in the commercial terms immediately — so the deal doesn't fall through while the formal paperwork catches up — without either side needing to wait on a solicitor before confirming they're both genuinely committed.</p>

<h2>Signing order matters</h2>
<p>Typically the buyer signs first, then the seller countersigns once the buyer's signature is confirmed. This sequencing protects the seller from countersigning (and effectively taking the property off the market) before knowing the buyer has actually committed.</p>

<h2>What happens once both parties have signed</h2>
<p>Once both signatures are in place, the matter is handed to a conveyancer or solicitor to prepare the formal, legally binding Contract of Sale based on the agreed terms. This is also typically the point at which any nominated conveyancer is formally engaged and briefed on the transaction.</p>

<h2>Is the Heads of Agreement legally binding?</h2>
<p>It documents an agreement in principle, but the parties' full legal rights and obligations are set out in the formal Contract of Sale once it's executed — including the buyer's statutory cooling-off rights, which apply to the formal contract. Treat the Heads of Agreement as a serious commitment, not as something either party can walk away from casually, but understand that the detailed legal mechanics live in the contract that follows.</p>

<h2>What sellers should check before signing</h2>
<p>Before countersigning, check that every commercial term matches what you actually agreed to verbally or in negotiation — price, deposit amount and timing, settlement date, and every condition (finance days, building &amp; pest days, any special conditions). Errors are far easier to fix at this stage than after the formal contract is drawn up.</p>

<div class="callout">If you haven't nominated your own conveyancer by this stage, this is the point in the process where one needs to be engaged — don't leave it until the contract is due to be signed.</div>
`,
  },
];

function guidePage(g) {
  const path = `/guides/${g.slug}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.desc,
    datePublished: g.published,
    author: { '@type': 'Organization', name: 'No Agents Pty Ltd', url: SITE },
    publisher: { '@type': 'Organization', name: 'No Agents Pty Ltd', url: SITE },
    mainEntityOfPage: SITE + path,
  };
  const others = GUIDES.filter(o => o.slug !== g.slug).slice(0, 3);
  return `${head(g.title, g.desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">Guide</span>
<h1 class="sf">${esc(g.title)}</h1>
</div>
<section><div class="wrap">
<article>
<div class="meta">Published ${new Date(g.published).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} · No Agents</div>
${g.body}
</article>
<div class="cta-band">
<h2 class="sf">Ready to sell without the commission?</h2>
<p>$798 flat fee · Domain.com.au listing · Photography &amp; 3D tour included</p>
<a class="cta" href="/sell">List my property →</a>
</div>
${others.length ? `<h2 class="sf" style="margin-top:40px">More guides</h2>${others.map(o => `<a class="card" href="/guides/${o.slug}"><h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p></a>`).join('')}` : ''}
</div></section>
${FOOTER}
</body></html>`;
}

function hubPage() {
  const path = '/guides';
  const title = 'Guides — selling property without an agent in Queensland | no-agents';
  const desc = 'Practical guides to selling your Queensland property privately: the process, the real cost of commission, building & pest, and the contract stages explained.';
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: SITE + path };
  return `${head(title, desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">Guides</span>
<h1 class="sf">Selling without an agent, explained.</h1>
<p class="sub">Practical, plain-English guides to the process, the real numbers, and what actually happens at each stage of a Queensland property sale.</p>
</div>
<section><div class="wrap">
${GUIDES.map(g => `<a class="card" href="/guides/${g.slug}"><h3>${esc(g.title)}</h3><p>${esc(g.summary)}</p></a>`).join('')}
</div></section>
${FOOTER}
</body></html>`;
}

export default function handler(req, res) {
  const slug = (req.query.slug || '').toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  if (!slug) return res.status(200).send(hubPage());
  const g = GUIDES.find(x => x.slug === slug);
  if (!g) {
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.status(404).send(`<!DOCTYPE html><html><head><title>Guide not found</title><meta name="robots" content="noindex"></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>We couldn't find that guide</h1><p><a href="/guides">Browse all guides</a></p></body></html>`);
  }
  return res.status(200).send(guidePage(g));
}

export { GUIDES };
