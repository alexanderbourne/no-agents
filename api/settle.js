// api/settle.js — Confirm settlement and charge the success fee
//
// POST /api/settle
// Headers: x-admin-token: <ADMIN_TOKEN>
// Body:    { listingId: string, salePrice: number }  (salePrice in whole AUD dollars)
//
// Fee: 0.5% of salePrice, capped at $15,000 AUD
// Charges the card saved at listing time (off-session PaymentIntent).
// Updates listing status → "sold" and records settlement metadata.

import Stripe from 'stripe';
import { verifyAdminToken } from './admin-auth.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN, STRIPE_SECRET_KEY, RESEND_API_KEY } = process.env;

const FEE_RATE   = 0.005;      // 0.5%
const FEE_CAP    = 15_000_00;  // $15,000 in cents

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!verifyAdminToken(req.headers['x-admin-token'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { listingId, salePrice } = req.body || {};
  if (!listingId || !salePrice || isNaN(Number(salePrice)) || Number(salePrice) <= 0) {
    return res.status(400).json({ error: 'listingId and a positive salePrice (AUD) are required' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  // Load listing
  const raw = await kvGet(`listing:${listingId}`);
  const listing = safeParse(raw);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status === 'sold') return res.status(409).json({ error: 'Listing already marked sold' });

  const salePriceNum   = Number(salePrice);
  const feeCents       = Math.min(Math.round(salePriceNum * FEE_RATE * 100), FEE_CAP);
  const feeDisplay     = (feeCents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  // Resolve payment method: prefer stored ID, fall back to customer's default
  let paymentMethodId = listing.stripePaymentMethodId || null;
  const customerId    = listing.stripeCustomerId || null;

  if (!paymentMethodId && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    paymentMethodId = customer.invoice_settings?.default_payment_method || null;
    if (!paymentMethodId) {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
      paymentMethodId = pms.data[0]?.id || null;
    }
  }

  if (!paymentMethodId) {
    return res.status(422).json({
      error: 'No saved payment method for this listing. Card was not saved at checkout — charge the fee manually.',
    });
  }

  // Charge off-session
  let charge;
  try {
    charge = await stripe.paymentIntents.create({
      amount:               feeCents,
      currency:             'aud',
      customer:             customerId || undefined,
      payment_method:       paymentMethodId,
      off_session:          true,
      confirm:              true,
      description:          `No Agents success fee — ${listing.address}, ${listing.suburb}`,
      metadata: {
        listingId,
        address:   listing.address || '',
        salePrice: String(salePriceNum),
        feeRate:   '0.5%',
      },
    });
  } catch (err) {
    console.error('Stripe off-session charge failed:', err.message);
    return res.status(402).json({
      error: `Card charge failed: ${err.message}. Collect fee manually.`,
      feeCents,
      feeDisplay,
    });
  }

  // Update listing in KV
  const settled = {
    ...listing,
    status:           'sold',
    settledAt:        new Date().toISOString(),
    salePrice:        salePriceNum,
    successFee:       feeCents / 100,
    settlementChargeId: charge.id,
  };
  await kvSet(`listing:${listingId}`, JSON.stringify(settled));

  // Emails
  if (RESEND_API_KEY) {
    const salePriceDisplay = salePriceNum.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
    if (listing.sellerEmail) {
      await sendEmail(listing.sellerEmail,
        `Settlement confirmed — ${listing.address}`,
        `<p>Hi ${listing.sellerName || 'there'},</p>
<p>Congratulations — your property at <strong>${listing.address}, ${listing.suburb}</strong> has settled.</p>
<p><strong>Sale price:</strong> ${salePriceDisplay}<br/>
<strong>No Agents success fee (0.5%):</strong> ${feeDisplay}<br/>
<strong>Stripe charge ID:</strong> ${charge.id}</p>
<p>Thank you for selling with No Agents. We've saved you the bulk of a traditional commission.</p>
<p>— Alexander Bourne<br/>No Agents Pty Ltd · Licence 4542501 (QLD)</p>`
      );
    }
    await sendEmail('alexander@no-agents.com.au',
      `✅ Settlement charged — ${listing.address}`,
      `<p>Settlement confirmed for <strong>${listing.address}, ${listing.suburb}</strong>.</p>
<p>Sale price: ${salePriceDisplay}<br/>
Success fee charged: ${feeDisplay}<br/>
Stripe charge ID: ${charge.id}<br/>
Seller: ${listing.sellerName || 'N/A'} (${listing.sellerEmail || 'N/A'})</p>`
    );
  }

  console.log(`[settle] ${listingId} settled at ${salePriceNum} — fee ${feeDisplay} charged (${charge.id})`);
  return res.status(200).json({ ok: true, listingId, salePrice: salePriceNum, feeCents, feeDisplay, chargeId: charge.id });
}

async function sendEmail(to, subject, html) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'no-agents.com.au <office@no-agents.com.au>', to: [to], subject, html }),
    });
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
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
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: value,
  });
  if (!r.ok) throw new Error(`KV set failed for ${key}: ${r.status}`);
}
