// api/seller-portal.js
// Authenticated seller dashboard data, backed by KV.
//
// All requests require header x-seller-token + query ?listingId=
//
//   GET  /api/seller-portal?listingId=xxx                 → listing, offers, inspections, enquiries, stats
//   POST /api/seller-portal?listingId=xxx&action=photoshoot     { } → request a photo shoot
//   POST /api/seller-portal?listingId=xxx&action=accept-offer   { offerId }
//   POST /api/seller-portal?listingId=xxx&action=counter-offer  { offerId, amount }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD

import { verifySellerToken } from './seller-auth.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

async function kvGet(key) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
  if (!r.ok) throw new Error(`KV set failed for ${key}: ${r.status}`);
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    let v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof v === 'string') v = JSON.parse(v);
    return v;
  } catch {
    return null;
  }
}

async function getListing(id) {
  return safeParse(await kvGet(`listing:${id}`));
}

async function getOffers(listingId) {
  const offers = safeParse(await kvGet(`offers:${listingId}`));
  return Array.isArray(offers) ? offers : [];
}

async function getInspectionsForListing(listing) {
  const ids = safeParse(await kvGet('inspections:all'));
  if (!Array.isArray(ids)) return [];
  const results = await Promise.all(ids.map(id => kvGet(`inspection:${id}`)));
  return results
    .map(safeParse)
    .filter(Boolean)
    .filter(i => i.listingId === listing.id || i.listingAddress === listing.address);
}

async function getEnquiriesForListing(listing) {
  const ids = safeParse(await kvGet('leads:index'));
  if (!Array.isArray(ids)) return [];
  const results = await Promise.all(ids.map(id => kvGet(`lead:${id}`)));
  return results
    .map(safeParse)
    .filter(Boolean)
    .filter(l => l.listingId === listing.id || (l.address && listing.address && l.address === listing.address));
}

export default async function handler(req, res) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return res.status(503).json({ error: 'KV not configured' });

  const { listingId } = req.query;
  const sellerToken = req.headers['x-seller-token'] || req.query.token;
  if (!listingId) return res.status(400).json({ error: 'listingId is required' });

  const listing = await getListing(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!listing.sellerPhone || !verifySellerToken(sellerToken, listing.sellerPhone)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const [offers, inspections, enquiries] = await Promise.all([
      getOffers(listingId),
      getInspectionsForListing(listing),
      getEnquiriesForListing(listing),
    ]);

    return res.status(200).json({
      listing,
      photoShoot: listing.photoShoot || { status: 'not_booked', date: null, notes: '' },
      offers,
      inspections,
      enquiries,
      stats: {
        views: listing.views || 0,
        enquiries: enquiries.length,
        offers: offers.length,
        inspections: inspections.length,
        topOffer: offers.length ? Math.max(...offers.map(o => o.amount || 0)) : 0,
      },
    });
  }

  if (req.method === 'POST') {
    const action = req.query.action;

    if (action === 'photoshoot') {
      listing.photoShoot = { status: 'requested', date: null, notes: '', requestedAt: new Date().toISOString() };
      await kvSet(`listing:${listingId}`, listing);
      return res.status(200).json({ ok: true, photoShoot: listing.photoShoot });
    }

    if (action === 'accept-offer') {
      const { offerId } = req.body || {};
      if (!offerId) return res.status(400).json({ error: 'offerId required' });
      const offers = await getOffers(listingId);
      const offer = offers.find(o => o.id === offerId);
      if (!offer) return res.status(404).json({ error: 'Offer not found' });
      offers.forEach(o => { o.status = o.id === offerId ? 'accepted' : 'declined'; });
      await kvSet(`offers:${listingId}`, offers);
      listing.status = 'agreed';
      await kvSet(`listing:${listingId}`, listing);
      return res.status(200).json({ ok: true, offers });
    }

    if (action === 'counter-offer') {
      const { offerId, amount } = req.body || {};
      if (!offerId || !amount) return res.status(400).json({ error: 'offerId and amount required' });
      const offers = await getOffers(listingId);
      const offer = offers.find(o => o.id === offerId);
      if (!offer) return res.status(404).json({ error: 'Offer not found' });
      offer.counterAmount = Number(amount);
      offer.status = 'countered';
      await kvSet(`offers:${listingId}`, offers);
      return res.status(200).json({ ok: true, offer });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).end();
}
