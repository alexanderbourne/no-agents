// api/checkout.js
// Creates a Stripe Checkout Session and returns the sessionId.
//
// POST { productName, amount (cents AUD), metadata }
// Response: { sessionId }

import Stripe from 'stripe';
import { generateListingId } from './listing-utils.js';
import { notifyAdmin } from './notify-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { productName, amount, metadata = {} } = req.body || {};

  if (!productName || !amount) {
    return res.status(400).json({ error: 'productName and amount are required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY env var not set');
    await notifyAdmin({
      subject: 'Stripe is DOWN — STRIPE_SECRET_KEY missing',
      html: `<p>A visitor tried to pay and checkout is completely broken: <code>STRIPE_SECRET_KEY</code> is not set in this environment.</p>
<p>No one can pay you until this is fixed. Check Vercel → Settings → Environment Variables.</p>`,
      isError: true,
    });
    return res.status(500).json({ error: 'Payment not configured — contact office@no-agents.com.au' });
  }

  const stripeMetadata = {};
  for (const [key, val] of Object.entries(metadata)) {
    if (val === null || val === undefined) continue;
    const str = Array.isArray(val) ? JSON.stringify(val) : String(val);
    stripeMetadata[key] = str.slice(0, 500);
  }

  // Listing purchases (Sell flow) carry sellerPhone+address — pre-generate the
  // listing ID so the success redirect can take the seller straight to their
  // dashboard once the webhook creates it.
  const isListingPurchase = Boolean(stripeMetadata.sellerPhone && stripeMetadata.address);
  const isAssistedTier = stripeMetadata.tier === 'assisted';
  const wantsAgentVisits = stripeMetadata.inspection === 'agent';
  if (isListingPurchase) {
    stripeMetadata.listingId = generateListingId('NA');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      (req.headers.origin ? req.headers.origin : 'https://no-agents.com.au');

    const successUrl = isListingPurchase
      ? `${baseUrl}/?payment=success&listingId=${encodeURIComponent(stripeMetadata.listingId)}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/?payment=success`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: { name: productName },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // Only save the card for later off-session charges when the seller explicitly
      // consented to at least one of: the Assisted Sale success fee, or per-visit
      // agent-visit billing. Sellers who choose neither never have a card saved.
      ...(isListingPurchase && (isAssistedTier || wantsAgentVisits) ? { payment_intent_data: { setup_future_usage: 'off_session' } } : {}),
      success_url: successUrl,
      cancel_url: `${baseUrl}/?payment=cancelled`,
      metadata: stripeMetadata,
      ...(stripeMetadata.sellerEmail ? { customer_email: stripeMetadata.sellerEmail } : {}),
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    await notifyAdmin({
      subject: 'Stripe checkout session creation failed',
      html: `<p>A buyer/seller could not start checkout — this blocks new revenue.</p>
<p><strong>Product:</strong> ${productName || 'unknown'} · <strong>Amount:</strong> ${amount || 'unknown'}</p>
<p><strong>Error:</strong> ${err.message}</p>`,
      isError: true,
    });
    return res.status(500).json({ error: err.message });
  }
}
