// api/feed.js — REAXML 1.0 feed for Domain / REA Group integration
// No Agents Pty Ltd | no-agents.com.au | QLD Licence 4542501
//
// Domain and REA Group poll this URL to sync active listings automatically.
// Feed URL: https://no-agents.com.au/api/feed
//
// Storage: Vercel KV (Upstash REST API)
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN
//
// Listing key structure in KV:
//   "listings:active"   → JSON array of active listing IDs (e.g. ["na-abc123"])
//   "listing:na-abc123" → JSON object (see schema in api/listing-store.js)
//
// If KV is not yet configured, an empty but valid feed is returned —
// the portal sync will never break.

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300'); // portals cache 5 min
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const listings = await getActiveListings();
    res.status(200).send(buildREAXML(listings));
  } catch (err) {
    console.error('[feed] Error generating REAXML:', err);
    // Always return a valid empty feed — never break portal sync
    res.status(200).send(buildREAXML([]));
  }
}

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

async function kvGet(key) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function getActiveListings() {
  const idsJson = await kvGet('listings:active');
  if (!idsJson) return [];

  let ids;
  try { ids = JSON.parse(idsJson); } catch { return []; }
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const results = await Promise.all(ids.map(id => kvGet(`listing:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    // 'pending' = paid but photography not yet confirmed ready, or the
    // seller's/photo-floor date hasn't arrived — must never appear in the
    // portal feed. See api/mark-photos-ready.js and api/cron-publish.js.
    .filter(l => l && l.status !== 'withdrawn' && l.status !== 'sold' && l.status !== 'pending');
}

// ---------------------------------------------------------------------------
// REAXML builder
// ---------------------------------------------------------------------------

function buildREAXML(listings) {
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const items = listings.map(l => buildResidential(l)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<propertyList date="${dateStr}">\n${items}\n</propertyList>`;
}

function buildResidential(l) {
  const now = new Date();
  const modTime = [
    now.toISOString().split('T')[0],
    now.toTimeString().slice(0, 8),
  ].join('-'); // YYYY-MM-DD-HH:MM:SS

  const id        = esc(String(l.id || `na-${Date.now()}`));
  const status    = l.status || 'current'; // current | sold | leased | offmarket
  const street    = esc(l.address || '');
  const suburb    = esc(l.suburb || '');
  const state     = esc(l.state || 'QLD');
  const postcode  = esc(l.postcode || '');
  const category  = mapCategory(l.type);
  const beds      = parseInt(l.beds || l.bedrooms || 0, 10);
  const baths     = parseInt(l.baths || l.bathrooms || 0, 10);
  const cars      = parseInt(l.cars || l.parking || 0, 10);
  const landSize  = parseInt(l.landSize || 0, 10);
  const floor     = parseInt(l.floor || l.floorSize || 0, 10);
  const priceNum  = parsePriceInt(l.price);
  const priceView = priceNum > 0
    ? `$${priceNum.toLocaleString('en-AU')}`
    : (l.priceView || 'Contact Agent');
  const headline  = esc(l.headline || `${beds > 0 ? beds + ' Bed ' : ''}${category} — No Commission`);
  const body      = esc(l.description || '');
  const deadline  = l.deadline ? `\n    <soldDetails>\n      <soldPrice display="no">0</soldPrice>\n      <soldDate>${esc(l.deadline)}</soldDate>\n    </soldDetails>` : '';

  // Vendor / seller
  const sellerName  = esc(l.sellerName || '');
  const sellerPhone = esc(l.sellerPhone || '');
  const sellerEmail = esc(l.sellerEmail || '');

  // Images
  const imageLines = (l.images || []).slice(0, 25).map((url, i) =>
    `    <img id="${i + 1}" format="jpg" url="${esc(url)}" modTime="${modTime}" last="${i === (l.images.length - 1) ? 'yes' : 'no'}"/>`
  ).join('\n');

  // Inspection times (array of ISO strings or human strings)
  const inspLines = (l.inspectionTimes || []).map(t =>
    `    <inspection>${esc(t)}</inspection>`
  ).join('\n');

  return `  <residential modTime="${modTime}" status="${status}">
    <agentID>NOAGENTS-QLD</agentID>
    <uniqueID>${id}</uniqueID>
    <authority value="exclusive"/>
    <underOffer value="no"/>
    <isHomeLandPackage value="no"/>
    <vendorDetails>
      <name>${sellerName}</name>
      <phone>${sellerPhone}</phone>
      <email>${sellerEmail}</email>
    </vendorDetails>
    <listingAgent id="1">
      <name>Alexander Bourne</name>
      <phone>0485043210</phone>
      <email>alexander@no-agents.com.au</email>
    </listingAgent>
    <address display="yes">
      <street>${street}</street>
      <suburb>${suburb}</suburb>
      <state>${state}</state>
      <postcode>${postcode}</postcode>
      <country>Australia</country>
    </address>
    <category value="${category}"/>
    <headline>${headline}</headline>
    <body>${body}</body>
    <price display="${priceNum > 0 ? 'yes' : 'no'}">${priceNum}</price>
    <priceView>${esc(priceView)}</priceView>
    <features>
      <bedrooms>${beds}</bedrooms>
      <bathrooms>${baths}</bathrooms>
      <garages>${cars}</garages>${landSize > 0 ? `\n      <landSize unit="squareMeter">${landSize}</landSize>` : ''}${floor > 0 ? `\n      <floorSize unit="squareMeter">${floor}</floorSize>` : ''}
    </features>${imageLines ? '\n' + imageLines : ''}${inspLines ? '\n' + inspLines : ''}${deadline}
  </residential>`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parsePriceInt(raw) {
  if (!raw) return 0;
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function mapCategory(type) {
  const map = {
    House: 'House',
    Apartment: 'Apartment',
    Unit: 'Unit',
    Townhouse: 'Townhouse',
    Villa: 'Villa',
    Land: 'Land',
    Rural: 'AcreageSemiRural',
    Acreage: 'AcreageSemiRural',
    Duplex: 'Duplex',
    Terrace: 'Terrace',
    Studio: 'Studio',
  };
  return map[type] || 'House';
}
