// Vercel Edge Middleware: serves route-specific <title>/meta/OG tags and a
// crawlable static content snapshot for the marketing routes below, so search
// and AI-answer crawlers that don't execute JS see real per-page content
// instead of the homepage's generic markup. The SPA script is untouched —
// Preact still hydrates over this and takes on client-side routing as normal.

export const config = { matcher: ['/sell', '/buy', '/fractional', '/for-agents'] };

const BASE = 'https://www.no-agents.com.au';

const ROUTES = {
  '/sell': {
    title: 'List your property for $798 flat — no commission | no-agents',
    description: 'List your Brisbane property in about 10 minutes. $798 covers Domain.com.au publication, professional photography and a 3D virtual tour. No commission.',
    ogDescription: 'List your Brisbane property in about 10 minutes for a $798 flat fee. Domain.com.au publication, professional photography and 3D tour included. No commission.',
    static: `<div style="max-width:760px;margin:0 auto;padding:88px 32px 72px;text-align:center;font-family:Inter,Arial,sans-serif">
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:#8a8078">Brisbane · Licensed Agency · Lic. 4542501</p>
  <h1 style="font-size:42px;font-weight:600;line-height:1.15;color:#1a1a1a;margin:16px 0">List your property for $798 flat.</h1>
  <p style="font-size:17px;color:#4a4540;line-height:1.75;max-width:520px;margin:0 auto 28px">Fill in your property details, set your availability and pay one flat fee. $798 covers listing creation, Domain.com.au publication, professional photography and a 3D virtual tour. No commission, ever.</p>
  <p><a href="/sell" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500">Start listing my property →</a></p>
  <h2 style="font-size:26px;font-weight:600;margin:48px 0 20px">What's included</h2>
  <ul style="text-align:left;max-width:560px;margin:0 auto;padding-left:20px;color:#4a4540;line-height:1.8;font-size:15px">
    <li>Domain.com.au listing publication — reaching 8 million Australians</li>
    <li>Professional photography, floor plans and a 3D virtual tour</li>
    <li>All enquiries, inspection bookings and offers managed on one dashboard</li>
    <li>Attend inspections yourself for free, or a licensed agent attends for $99 per visit</li>
    <li>An open offer board — every verified offer visible to every buyer, no gazumping</li>
  </ul>
  <p style="margin-top:40px;font-size:14px;color:#8a8078">See suburb-specific commission savings at <a href="/sell-your-house" style="color:#a07828">no-agents.com.au/sell-your-house</a>.</p>
</div>`,
  },
  '/buy': {
    title: 'Buy a no-agents property — transparent open offers | no-agents',
    description: 'Search no-agents listings and make offers on a transparent open offer board. Every verified offer visible to every buyer. No gazumping, no blind bidding.',
    ogDescription: 'Search no-agents listings and make offers on a transparent open offer board. Every verified offer visible to every buyer.',
    static: `<div style="max-width:760px;margin:0 auto;padding:88px 32px 72px;text-align:center;font-family:Inter,Arial,sans-serif">
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:#8a8078">Brisbane · Licensed Agency · Lic. 4542501</p>
  <h1 style="font-size:42px;font-weight:600;line-height:1.15;color:#1a1a1a;margin:16px 0">Buy with full transparency.</h1>
  <p style="font-size:17px;color:#4a4540;line-height:1.75;max-width:520px;margin:0 auto 28px">Every no-agents listing runs on an open offer board. Every verified offer is visible to every buyer — no gazumping, no blind bidding, no agent steering the price.</p>
  <p><a href="/buy" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500">Search a listing →</a></p>
  <h2 style="font-size:26px;font-weight:600;margin:48px 0 20px">How offers work</h2>
  <ul style="text-align:left;max-width:560px;margin:0 auto;padding-left:20px;color:#4a4540;line-height:1.8;font-size:15px">
    <li>Find a property by address and verify your identity to unlock full details</li>
    <li>Book an inspection — attend with the seller or a licensed no-agents agent</li>
    <li>Submit a verified offer with your settlement terms, finance and building conditions</li>
    <li>See every other verified offer on the same board in real time</li>
    <li>Accepted offers proceed to contract through the seller's conveyancer</li>
  </ul>
</div>`,
  },
  '/fractional': {
    title: 'Fractional property ownership — own a Slice | no-agents',
    description: 'Register interest in No Agents Fractional: buy Slices in residential property, earn monthly income and capital growth. Expression of interest now open.',
    ogDescription: 'Buy Slices in residential property, earn monthly income and capital growth. Expression of interest now open.',
    static: `<div style="max-width:760px;margin:0 auto;padding:88px 32px 72px;text-align:center;font-family:Inter,Arial,sans-serif">
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:#8a8078">Expression of Interest — Not Yet Live</p>
  <h1 style="font-size:42px;font-weight:600;line-height:1.15;color:#1a1a1a;margin:16px 0">Own a Slice of Brisbane property.</h1>
  <p style="font-size:17px;color:#4a4540;line-height:1.75;max-width:520px;margin:0 auto 28px">No Agents Fractional lets you buy Slices in residential property — earning monthly rental income and a share of capital growth, without the deposit or debt of buying a whole home.</p>
  <p><a href="/fractional" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500">Register your interest →</a></p>
  <h2 style="font-size:26px;font-weight:600;margin:48px 0 20px">How it works</h2>
  <ul style="text-align:left;max-width:560px;margin:0 auto;padding-left:20px;color:#4a4540;line-height:1.8;font-size:15px">
    <li>A property is divided into Slices, each representing a small ownership share</li>
    <li>Buy as many or as few Slices as you want, funded from savings or finance</li>
    <li>Earn your share of monthly rental income plus capital growth on sale</li>
    <li>Sellers can retain a stake and free up capital by selling only some Slices</li>
  </ul>
  <p style="margin-top:24px;font-size:13px;color:#8a8078">This product is subject to regulatory approval and is not yet available for investment.</p>
</div>`,
  },
  '/for-agents': {
    title: 'Earn $70 per inspection — for licensed QLD agents | no-agents',
    description: 'Licensed Queensland agents: pick up buyer inspections around Brisbane at $70 per confirmed inspection, paid weekly. Join the panel in 2 minutes.',
    ogDescription: 'Licensed Queensland agents: pick up buyer inspections around Brisbane at $70 per confirmed inspection, paid weekly.',
    static: `<div style="max-width:760px;margin:0 auto;padding:88px 32px 72px;text-align:center;font-family:Inter,Arial,sans-serif">
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:#8a8078">For Licensed QLD Agents</p>
  <h1 style="font-size:42px;font-weight:600;line-height:1.15;color:#1a1a1a;margin:16px 0">Earn $70 per inspection.</h1>
  <p style="font-size:17px;color:#4a4540;line-height:1.75;max-width:520px;margin:0 auto 28px">Licensed Queensland agents can pick up buyer inspections around Brisbane at $70 per confirmed inspection, paid weekly — work under our licence as a contractor, on your own schedule.</p>
  <p><a href="/for-agents" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500">Join the panel →</a></p>
  <h2 style="font-size:26px;font-weight:600;margin:48px 0 20px">How it works</h2>
  <ul style="text-align:left;max-width:560px;margin:0 auto;padding-left:20px;color:#4a4540;line-height:1.8;font-size:15px">
    <li>Receive a booking notification for a confirmed inspection near you</li>
    <li>Show up, let the buyer in, show them through, lock up — no listing admin</li>
    <li>Get paid $70 direct to your bank account weekly, no settlement wait, no splits</li>
    <li>Covered under our agency PI and public liability insurance for every inspection</li>
    <li>Keep your current agency role — this is contract work on the side, or full time</li>
  </ul>
</div>`,
  },
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const route = ROUTES[url.pathname];
  if (!route) return fetch(request);

  const originRes = await fetch(new URL('/', url));
  let html = await originRes.text();

  const canonical = `${BASE}${url.pathname}`;
  const metaBlock = `<!--SEO_META_START-->
<title>${route.title}</title>
<meta name="description" content="${route.description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="no-agents">
<meta property="og:title" content="${route.title}">
<meta property="og:description" content="${route.ogDescription}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}/no-agents-hero.jpg">
<meta property="og:locale" content="en_AU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${route.title}">
<meta name="twitter:description" content="${route.ogDescription}">
<meta name="twitter:image" content="${BASE}/no-agents-hero.jpg">
<!--SEO_META_END-->`;

  html = html.replace(/<!--SEO_META_START-->[\s\S]*?<!--SEO_META_END-->/, metaBlock);
  html = html.replace(
    /<!--STATIC_CONTENT_START-->[\s\S]*?<!--STATIC_CONTENT_END-->/,
    `<!--STATIC_CONTENT_START-->${route.static}<!--STATIC_CONTENT_END-->`
  );

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
