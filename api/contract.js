// api/contract.js
// Buyer-side access to a populated sales contract via a one-time magic-link
// token (no buyer account system exists, so the token itself is the auth).
//
// GET  /api/contract?listingId=xxx&token=xxx           → contract + listing summary
// POST /api/contract?listingId=xxx&token=xxx&action=sign { signedByName }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY (optional)

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

async function notifySellerTurn(listing) {
  if (!RESEND_API_KEY || !listing.sellerEmail) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents <office@no-agents.com.au>',
        to: [listing.sellerEmail],
        subject: `${listing.contract.buyerName} has signed — your turn — ${listing.address}`,
        html: `<div style="font-family:sans-serif;max-width:500px;">
          <h2>The buyer has signed</h2>
          <p>${listing.contract.buyerName} has signed the contract for <strong>${listing.address}</strong>. It's now ready for your signature on your seller dashboard, under the Documents tab.</p>
        </div>`,
      }),
    });
  } catch (e) { console.error('contract seller-turn notify error:', e.message); }
}

async function notifyBothExecuted(listing) {
  if (!RESEND_API_KEY) return;
  const recipients = [listing.sellerEmail, listing.contract.buyerEmail].filter(Boolean);
  if (!recipients.length) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents <office@no-agents.com.au>',
        to: recipients,
        subject: `Heads of Agreement signed by both parties — ${listing.address}`,
        html: `<div style="font-family:sans-serif;max-width:500px;">
          <h2>Heads of Agreement signed by both parties</h2>
          <p>The agreed terms for <strong>${listing.address}</strong> have now been signed by both the seller and the buyer.</p>
          <p>This is being passed to the seller's conveyancer, who will prepare the formal Contract of Sale and be in touch to finalise it.</p>
        </div>`,
      }),
    });
  } catch (e) { console.error('contract executed notify error:', e.message); }
}

export default async function handler(req, res) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return res.status(503).json({ error: 'KV not configured' });

  const { listingId, token } = req.query;
  if (!listingId || !token) return res.status(400).json({ error: 'listingId and token are required' });

  const listing = safeParse(await kvGet(`listing:${listingId}`));
  if (!listing || !listing.contract || listing.contract.buyerAccessToken !== token) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      address: listing.address,
      sellerName: listing.sellerName,
      contract: listing.contract,
    });
  }

  if (req.method === 'POST' && req.query.action === 'sign') {
    const { signedByName, signatureImage } = req.body || {};
    const name = (signedByName || listing.contract.buyerName || '').trim();
    if (!name) return res.status(400).json({ error: 'signedByName required' });
    if (!signatureImage) return res.status(400).json({ error: 'signatureImage required' });

    listing.contract.buyerSigned = { signedAt: new Date().toISOString(), signedByName: name, signatureImage };
    await kvSet(`listing:${listingId}`, listing);

    if (listing.contract.sellerSigned) {
      await notifyBothExecuted(listing);
    } else {
      await notifySellerTurn(listing);
    }

    return res.status(200).json({ ok: true, contract: listing.contract });
  }

  return res.status(405).end();
}
