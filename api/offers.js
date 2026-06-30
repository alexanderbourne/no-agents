// api/offers.js
// Public endpoint for buyers to submit a real offer against a listing.
// Buyer identity is SMS-verified client-side before this is called (same
// trust model already used for inspection-booking requests in this codebase).
//
// POST /api/offers { listingId, amount, buyerName, buyerEmail, buyerPhone, ... }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY (optional, seller notify)

const { KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY } = process.env;

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
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error(`KV set failed: ${r.status}`);
}

function safeParse(raw) {
  if (raw === null || raw === undefined) return null;
  let v = raw;
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.value === 'string') {
    try { v = JSON.parse(v.value); } catch {}
  }
  return v;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return res.status(503).json({ error: 'KV not configured' });

  const {
    listingId, amount, buyerName, buyerEmail, buyerPhone,
    settlement, finance, financeDays, building, buildingDays,
    conditions, initialDeposit, balanceDeposit, coolingOff, solicitor,
  } = req.body || {};

  if (!listingId || !amount || !buyerName) {
    return res.status(400).json({ error: 'listingId, amount and buyerName are required' });
  }

  const listing = safeParse(await kvGet(`listing:${listingId}`));
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const id = `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const offer = {
    id,
    amount: Number(amount),
    buyer: (buyerName || '').trim(),
    buyerEmail: (buyerEmail || '').trim(),
    buyerPhone: (buyerPhone || '').trim(),
    time: 'just now',
    settlement: Number(settlement) || 60,
    finance: Boolean(finance),
    financeDays: financeDays || null,
    building: Boolean(building),
    buildingDays: buildingDays || null,
    conditions: (conditions || '').trim(),
    initialDeposit: initialDeposit || null,
    balanceDeposit: balanceDeposit || null,
    coolingOff: Boolean(coolingOff),
    solicitor: solicitor || null,
    verified: true,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  const offers = safeParse(await kvGet(`offers:${listingId}`));
  const list = Array.isArray(offers) ? offers : [];
  list.push(offer);
  await kvSet(`offers:${listingId}`, list);

  if (listing.sellerEmail && RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'No Agents <office@no-agents.com.au>',
          to: [listing.sellerEmail],
          subject: `New offer on ${listing.address} — $${offer.amount.toLocaleString()}`,
          html: `<div style="font-family:sans-serif;max-width:500px;">
            <h2>New offer received</h2>
            <p><strong>$${offer.amount.toLocaleString()}</strong> from ${offer.buyer}, ${offer.settlement}-day settlement.</p>
            <p>Log in to your seller dashboard at no-agents.com.au to review and respond.</p>
          </div>`,
        }),
      });
    } catch (e) { console.error('offers notify error:', e.message); }
  }

  return res.status(200).json({ ok: true, offer });
}
