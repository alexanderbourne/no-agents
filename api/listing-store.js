// api/listing-store.js — Internal listing CRUD endpoint
// No Agents Pty Ltd | no-agents.com.au
//
// Called by api/stripe-webhook.js after payment is confirmed to persist a
// listing into Vercel KV so that api/feed.js can serve it to Domain / REA.
//
// ─── Endpoints ──────────────────────────────────────────────────────────────
//
//   POST /api/listing-store          Create or update a listing
//   GET  /api/listing-store          List all active listings (admin)
//   GET  /api/listing-store?id=xxx   Retrieve single listing
//   DELETE /api/listing-store?id=xxx Withdraw a listing
//
// ─── Auth ────────────────────────────────────────────────────────────────────
//   All requests require header:  x-api-secret: <LISTING_API_SECRET env var>
//
// ─── Required env vars ───────────────────────────────────────────────────────
//   KV_REST_API_URL     — Vercel KV (Upstash) REST base URL
//   KV_REST_API_TOKEN   — Vercel KV read-write token
//   LISTING_API_SECRET  — Shared secret for webhook → this endpoint
//
// ─── Listing schema ──────────────────────────────────────────────────────────
//   {
//     id:             string    // auto-generated "na-<timestamp>-<rand>"
//     status:         "current" | "sold" | "leased" | "withdrawn" | "offmarket"
//     createdAt:      ISO string
//     address:        string    // street e.g. "12 Smith Street"
//     suburb:         string
//     state:          string    // default "QLD"
//     postcode:       string
//     type:           string    // House | Apartment | Unit | Townhouse | …
//     beds:           number
//     baths:          number
//     cars:           number
//     floor:          number    // floor area m²
//     landSize:       number    // land area m²
//     price:          string    // "$750,000" or "750000"
//     priceView:      string    // display string override
//     deadline:       string    // campaign end / auction date
//     description:    string
//     headline:       string
//     images:         string[]  // public image URLs
//     inspectionTimes: string[] // human-readable strings
//     sellerName:     string
//     sellerEmail:    string
//     sellerPhone:    string
//     stripeSessionId: string   // traceability
//     views:          number    // listing page views, used by seller dashboard stats
//     photoShoot:     { status: "not_booked"|"requested"|"booked"|"completed", date: string|null, notes: string }
//   }

const { KV_REST_API_URL, KV_REST_API_TOKEN, LISTING_API_SECRET } = process.env;

export default async function handler(req, res) {
  // ── Public search (no auth) ──
  if (req.method === 'GET' && req.query.search) {
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return res.status(200).json({ listing: null });
    const query = req.query.search.toLowerCase().trim();
    const ids = await getActiveIds();
    for (const lid of ids) {
      const r = await kvGet(`listing:${lid}`);
      if (!r) continue;
      try {
        const listing = JSON.parse(r);
        const addr = `${listing.address || ''} ${listing.suburb || ''} ${listing.state || ''} ${listing.postcode || ''}`.toLowerCase();
        if (addr.includes(query) || query.includes((listing.address || '').toLowerCase())) {
          return res.status(200).json({ listing });
        }
      } catch {}
    }
    return res.status(200).json({ listing: null });
  }

  // ── Auth ──
  if (req.headers['x-api-secret'] !== LISTING_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV storage not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.' });
  }

  // ── Route ──
  switch (req.method) {
    case 'POST':   return handleCreate(req, res);
    case 'GET':    return handleGet(req, res);
    case 'DELETE': return handleDelete(req, res);
    default:
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ─── Create / Update ────────────────────────────────────────────────────────

async function handleCreate(req, res) {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'Body required' });

  const id = data.id || `na-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const listing = {
    ...data,
    id,
    status: data.status || 'current',
    createdAt: data.createdAt || new Date().toISOString(),
    photoShoot: data.photoShoot || { status: 'not_booked', date: null, notes: '' },
  };

  // Save listing
  await kvSet(`listing:${id}`, JSON.stringify(listing));

  // Add to active index (avoid duplicates)
  const ids = await getActiveIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await kvSet('listings:active', JSON.stringify(ids));
  }

  console.log(`[listing-store] Created listing ${id} — ${listing.address}, ${listing.suburb}`);
  return res.status(200).json({ success: true, id, listing });
}

// ─── Read ────────────────────────────────────────────────────────────────────

async function handleGet(req, res) {
  const { id } = req.query;

  if (id) {
    const raw = await kvGet(`listing:${id}`);
    if (!raw) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ listing: JSON.parse(raw) });
  }

  // All active listings
  const ids = await getActiveIds();
  const listings = (await Promise.all(
    ids.map(async lid => {
      const r = await kvGet(`listing:${lid}`);
      try { return r ? JSON.parse(r) : null; } catch { return null; }
    })
  )).filter(Boolean);

  return res.status(200).json({ count: listings.length, listings });
}

// ─── Delete / Withdraw ───────────────────────────────────────────────────────

async function handleDelete(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  // Mark as withdrawn rather than hard-delete (REAXML portals need to see it disappear)
  const raw = await kvGet(`listing:${id}`);
  if (raw) {
    const listing = { ...JSON.parse(raw), status: 'withdrawn', withdrawnAt: new Date().toISOString() };
    await kvSet(`listing:${id}`, JSON.stringify(listing));
  }

  // Remove from active index
  const ids = await getActiveIds();
  const updated = ids.filter(i => i !== id);
  await kvSet('listings:active', JSON.stringify(updated));

  console.log(`[listing-store] Withdrawn listing ${id}`);
  return res.status(200).json({ success: true, id });
}

// ─── KV helpers ─────────────────────────────────────────────────────────────

async function kvGet(key) {
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
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
  if (!r.ok) throw new Error(`KV set failed for key ${key}: ${r.status}`);
  return r.json();
}

async function getActiveIds() {
  const raw = await kvGet('listings:active');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
