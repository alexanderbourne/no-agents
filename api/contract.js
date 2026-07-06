// api/contract.js
// Buyer-side access to a populated sales contract via a one-time magic-link
// token (no buyer account system exists, so the token itself is the auth).
//
// GET  /api/contract?listingId=xxx&token=xxx           → contract + listing summary
// POST /api/contract?listingId=xxx&token=xxx&action=sign { signedByName }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY (optional)

import { notifyConveyancer, effectiveConveyancer, getDefaultConveyancer } from './conveyancing-handoff.js';
import { notifyMortgageBroker } from './mortgage-broker.js';
import { notifySeller } from './notify-seller.js';

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
  await notifySeller({
    listing,
    subject: `${listing.contract.buyerName} has signed — your turn — ${listing.address}`,
    html: `<div style="font-family:sans-serif;max-width:500px;">
      <h2>The buyer has signed</h2>
      <p>${listing.contract.buyerName} has signed the contract for <strong>${listing.address}</strong>. It's now ready for your signature on your seller dashboard, under the Documents tab.</p>
    </div>`,
    sms: `No Agents: ${listing.contract.buyerName} has signed the contract for ${listing.address}. It's your turn — sign it in your seller dashboard.`,
  });
}

async function notifyBothExecuted(listing) {
  const conveyancer = effectiveConveyancer(listing);
  const handoffLine = conveyancer?.email
    ? (conveyancer.isDefault
        ? 'This has been passed to our conveyancing partner, who will prepare the formal Contract of Sale and be in touch to finalise it.'
        : `This has been passed to ${conveyancer.name || 'your nominated conveyancer'}, who will prepare the formal Contract of Sale and be in touch to finalise it.`)
    : null;

  if (listing.contract.buyerEmail && RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'No Agents <office@no-agents.com.au>',
          to: [listing.contract.buyerEmail],
          subject: `Heads of Agreement signed by both parties — ${listing.address}`,
          html: `<div style="font-family:sans-serif;max-width:500px;">
            <h2>Heads of Agreement signed by both parties</h2>
            <p>The agreed terms for <strong>${listing.address}</strong> have now been signed by both the seller and the buyer.</p>
            <p>${handoffLine || "The seller's conveyancer or solicitor will be in touch to prepare the formal Contract of Sale."}</p>
          </div>`,
        }),
      });
    } catch (e) { console.error('contract executed notify error:', e.message); }
  }

  await notifySeller({
    listing,
    subject: `Heads of Agreement signed by both parties — ${listing.address}`,
    html: `<div style="font-family:sans-serif;max-width:500px;">
      <h2>Heads of Agreement signed by both parties</h2>
      <p>The agreed terms for <strong>${listing.address}</strong> have now been signed by both you and the buyer.</p>
      <p>${handoffLine || 'Engage your conveyancer or solicitor to prepare the formal Contract of Sale — nominate one in your dashboard Settings tab so we can notify them automatically next time.'}</p>
    </div>`,
    sms: `No Agents: Heads of Agreement for ${listing.address} signed by both parties.${handoffLine ? '' : ' Nominate a conveyancer in your dashboard Settings.'}`,
  });

  return { conveyancerNotified: await notifyConveyancer(listing) };
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
      suburb: listing.suburb,
      sellerName: listing.sellerName,
      contract: listing.contract,
    });
  }

  // Buyer opts in to an introduction to our default conveyancing partner —
  // only offered when the seller nominated their own (see api/seller-portal.js,
  // action=accept-offer), since the two parties can't share a conveyancer.
  if (req.method === 'POST' && req.query.action === 'request-conveyancer') {
    if (!listing.contract.offerConveyancerToBuyer) {
      return res.status(400).json({ error: 'No introduction is available for this contract.' });
    }
    if (listing.contract.buyerConveyancerRequested) {
      return res.status(200).json({ ok: true, alreadyRequested: true });
    }

    const partner = getDefaultConveyancer();
    if (!partner?.email) {
      return res.status(503).json({ error: 'No conveyancing partner is configured right now — please arrange your own.' });
    }

    let sent = false;
    if (RESEND_API_KEY) {
      try {
        const res2 = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'No Agents <office@no-agents.com.au>',
            to: [partner.email],
            subject: `Buyer introduction requested — ${listing.address}`,
            html: `<div style="font-family:sans-serif;max-width:500px;">
              <h2>Buyer introduction requested</h2>
              <p>The buyer on <strong>${listing.address}, ${listing.suburb || ''}</strong> does not have a conveyancer yet (the seller is using their own) and has requested an introduction to you via no-agents.com.au.</p>
              <p><strong>Buyer:</strong> ${listing.contract.buyerName || '—'} · ${listing.contract.buyerEmail || '—'} · ${listing.contract.buyerPhone || '—'}</p>
              <p style="font-size:12px;color:#999;">Reply directly to the buyer to proceed.</p>
            </div>`,
          }),
        });
        sent = res2.ok;
      } catch (e) { console.error('request-conveyancer notify error:', e.message); }
    }

    listing.contract.buyerConveyancerRequested = true;
    await kvSet(`listing:${listingId}`, listing);
    return res.status(200).json({ ok: true, sent });
  }

  // Buyer opts in to an introduction to our mortgage broker — only offered
  // when their accepted offer actually has a finance condition, since a
  // buyer who didn't need one has nothing to refer.
  if (req.method === 'POST' && req.query.action === 'request-mortgage-broker') {
    if (!listing.contract.finance) {
      return res.status(400).json({ error: 'No finance condition on this contract.' });
    }
    if (listing.contract.mortgageBrokerRequested) {
      return res.status(200).json({ ok: true, alreadyRequested: true });
    }

    const sent = await notifyMortgageBroker({
      buyerName: listing.contract.buyerName,
      buyerEmail: listing.contract.buyerEmail,
      buyerPhone: listing.contract.buyerPhone,
      address: `${listing.address}, ${listing.suburb || ''}`.trim(),
    });

    listing.contract.mortgageBrokerRequested = true;
    await kvSet(`listing:${listingId}`, listing);
    return res.status(200).json({ ok: true, sent });
  }

  if (req.method === 'POST' && req.query.action === 'sign') {
    const { signedByName, signatureImage } = req.body || {};
    const name = (signedByName || listing.contract.buyerName || '').trim();
    if (!name) return res.status(400).json({ error: 'signedByName required' });
    if (!signatureImage) return res.status(400).json({ error: 'signatureImage required' });

    listing.contract.buyerSigned = { signedAt: new Date().toISOString(), signedByName: name, signatureImage };

    if (listing.contract.sellerSigned) {
      const { conveyancerNotified } = await notifyBothExecuted(listing);
      listing.conveyancingHandoff = {
        notified: conveyancerNotified,
        notifiedAt: new Date().toISOString(),
        sentTo: conveyancerNotified ? (effectiveConveyancer(listing)?.email || null) : null,
      };
      await kvSet(`listing:${listingId}`, listing);
    } else {
      await kvSet(`listing:${listingId}`, listing);
      await notifySellerTurn(listing);
    }

    return res.status(200).json({ ok: true, contract: listing.contract });
  }

  return res.status(405).end();
}
