// api/route-meta.js — per-route SEO metadata for SPA marketing pages
// No Agents Pty Ltd | no-agents.com.au | QLD Licence 4542501
//
// Problem: /sell, /buy, /fractional and /for-agents are rewritten (see
// vercel.json) to the same static index.html as the homepage, so crawlers
// and link-preview bots that don't execute JavaScript see the homepage's
// <title>, meta description and — critically — a <link rel="canonical">
// pointing back to "/". That canonical tells Google not to index these
// pages as distinct content, even though they're the site's highest-intent
// commercial pages and are listed separately (with their own priority) in
// sitemap.xml.
//
// The client-side app already computes the correct per-route title/
// description via ROUTE_META + applyMeta() in index.html, but only after
// JavaScript runs — too late for many crawlers and all non-JS link
// unfurlers (Slack, iMessage, etc).
//
// Fix: fetch the real homepage HTML at request time (so we're always in
// sync with whatever is currently deployed) and swap in the route-specific
// title/description/canonical/OG/Twitter values before serving it. The
// page body and the inline app script are untouched — the Preact app boots
// exactly as it does today and reads the URL itself via pathToView(), so
// none of the Sell/Buy/checkout/signing logic is touched by this file.
//
// Keep ROUTE_META below in sync with the ROUTE_META object inside
// index.html if that copy ever changes.

const SITE = 'https://www.no-agents.com.au';

const ROUTE_META = {
  sell: {
    path: '/sell',
    t: 'List your property for $798 flat — no commission | no-agents',
    d: 'List your Brisbane property in about 10 minutes. $798 covers Domain.com.au publication, professional photography and a 3D virtual tour. No commission.',
  },
  buy: {
    path: '/buy',
    t: 'Buy a no-agents property — transparent open offers | no-agents',
    d: 'Search no-agents listings and make offers on a transparent open offer board. Every verified offer visible to every buyer. No gazumping, no blind bidding.',
  },
  fractional: {
    path: '/fractional',
    t: 'Fractional property ownership — own a Slice | no-agents',
    d: 'Register interest in No Agents Fractional: buy Slices in residential property, earn monthly income and capital growth. Expression of interest now open.',
  },
  agents: {
    path: '/for-agents',
    t: 'Earn $70 per inspection — for licensed QLD agents | no-agents',
    d: 'Licensed Queensland agents: pick up buyer inspections around Brisbane at $70 per confirmed inspection, paid weekly. Join the panel in 2 minutes.',
  },
};

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  const view = (req.query && req.query.view) || '';
  const meta = ROUTE_META[view];

  if (!meta) {
    res.status(404).send('Not found');
    return;
  }

  try {
    const homeRes = await fetch(`${SITE}/`);
    let html = await homeRes.text();

    const title = escapeHtml(meta.t);
    const desc = escapeAttr(meta.d);
    const url = `${SITE}${meta.path}`;

    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeAttr(meta.t)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeAttr(meta.t)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (err) {
    console.error('[route-meta] Error rewriting meta, serving home unmodified:', err);
    // Fail safe: never break the page for a real visitor — fall back to
    // fetching home directly with no meta substitution.
    try {
      const homeRes = await fetch(`${SITE}/`);
      const html = await homeRes.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch {
      res.status(500).send('Internal error');
    }
  }
}
