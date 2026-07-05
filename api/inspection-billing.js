// api/inspection-billing.js
// Charges the $99 Human Agent Visit fee to the seller's saved card once an
// agent has confirmed/claimed an inspection (see api/agent-portal.js and
// api/inspections.js). Only fires for listings where the seller opted into
// agent-assisted visits at listing time (inspectionMode === 'agent') and
// only if a card was saved for that purpose (see api/checkout.js).
//
// Never throws — a billing failure must not block an inspection being
// booked or an agent commission being recorded. On failure it alerts admin
// so the fee can be collected manually.

import Stripe from 'stripe';
import { notifyAdmin } from './notify-admin.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN, STRIPE_SECRET_KEY } = process.env;

const VISIT_FEE_CENTS = 99_00;

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
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

export async function findListingByAddress(address) {
  const ids = safeParse(await kvGet('listings:active'));
  if (!Array.isArray(ids)) return null;
  const needle = (address || '').toLowerCase().trim();
  if (!needle) return null;
  for (const id of ids) {
    const listing = safeParse(await kvGet(`listing:${id}`));
    if (listing && (listing.address || '').toLowerCase().trim() === needle) return listing;
  }
  return null;
}

// Resolves the listing by listingId (preferred) or address, and — if it opted
// into agent-assisted visits and has a saved card — charges the $99 visit fee.
export async function chargeInspectionVisit({ listingId, address, inspectionId }) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return { charged: false, reason: 'not_configured', listing: null };
  }

  const listing = listingId
    ? safeParse(await kvGet(`listing:${listingId}`))
    : await findListingByAddress(address);

  if (!listing) return { charged: false, reason: 'listing_not_found', listing: null };
  if (listing.inspectionMode !== 'agent') return { charged: false, reason: 'not_agent_mode', listing };
  if (!STRIPE_SECRET_KEY) return { charged: false, reason: 'not_configured', listing };

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const customerId = listing.stripeCustomerId || null;
  let paymentMethodId = listing.stripePaymentMethodId || null;

  if (!paymentMethodId && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      paymentMethodId = customer.invoice_settings?.default_payment_method || null;
      if (!paymentMethodId) {
        const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
        paymentMethodId = pms.data[0]?.id || null;
      }
    } catch (e) {
      console.error('chargeInspectionVisit — payment method lookup failed:', e.message);
    }
  }

  if (!paymentMethodId) return { charged: false, reason: 'no_saved_card', listing };

  try {
    const charge = await stripe.paymentIntents.create({
      amount: VISIT_FEE_CENTS,
      currency: 'aud',
      customer: customerId || undefined,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `No Agents human agent visit — ${listing.address}`,
      metadata: { listingId: listing.id || listingId || '', address: listing.address || '', inspectionId: inspectionId || '' },
    });
    return { charged: true, chargeId: charge.id, listingId: listing.id || listingId || null, listing };
  } catch (err) {
    console.error('chargeInspectionVisit failed:', err.message);
    await notifyAdmin({
      subject: `Agent visit fee ($99) failed to charge — ${listing.address}`,
      html: `<p>An agent confirmed an inspection at <strong>${listing.address}</strong> but the $99 visit fee could not be charged automatically.</p>
<p><strong>Error:</strong> ${err.message}</p>
<p>Collect the $99 manually from ${listing.sellerName || 'the seller'} (${listing.sellerEmail || listing.sellerPhone || 'no contact on file'}).</p>`,
      isError: true,
    });
    return { charged: false, reason: err.message, listing };
  }
}
