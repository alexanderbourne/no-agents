// api/stripe-webhook.js
// Handles Stripe checkout.session.completed events.
// bodyParser disabled — raw body required for signature verification.

import Stripe from 'stripe';
import { parseAddress, generateListingId } from './listing-utils.js';
import { notifyAdmin } from './notify-admin.js';

export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    await notifyAdmin({
      subject: 'Stripe webhook signature verification failed',
      html: `<p>A request to <code>/api/stripe-webhook</code> failed signature verification.</p>
<p><strong>Error:</strong> ${err.message}</p>
<p>This usually means <code>STRIPE_WEBHOOK_SECRET</code> is wrong/stale, or someone is hitting the endpoint directly. Check the Stripe Dashboard → Developers → Webhooks for delivery attempts.</p>`,
      isError: true,
    });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata || {};

  console.log('Payment complete:', meta.address || session.id);

  const addressParts = parseAddress(meta.address || '');
  const uniqueId = meta.listingId || generateListingId('NA');

  const listing = {
    uniqueId,
    tier:                  meta.tier === 'assisted' ? 'assisted' : 'flat',
    stripeCustomerId:      session.customer || null,
    stripePaymentMethodId: session.payment_method || null,
    address:      meta.address || '',
    ...addressParts,
    beds:         parseInt(meta.beds) || 0,
    baths:        parseInt(meta.baths) || 0,
    cars:         parseInt(meta.cars) || 0,
    price:        parseInt(meta.price) || 0,
    priceView:    meta.priceView || '',
    description:  meta.description || 'Contact agent for details.',
    headline:     meta.headline || '',
    propertyType: meta.propertyType || 'Apartment',
    agentName:    'Alexander Bourne',
    agentEmail:   'alexander@no-agents.com.au',
    agentPhone:   '0485043210',
    agencyName:   'No Agents Pty Ltd',
    images:       meta.images ? JSON.parse(meta.images) : [],
    sellerEmail:  meta.sellerEmail || session.customer_details?.email || '',
    sellerName:   meta.sellerName || '',
    sellerPhone:  meta.sellerPhone || '',
  };

  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://no-agents.com.au';

    if (process.env.LISTING_API_SECRET) {
      const storeRes = await fetch(`${base}/api/listing-store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': process.env.LISTING_API_SECRET,
        },
        body: JSON.stringify({
          ...listing,
          id: listing.uniqueId,
          suburb: listing.suburb,
          state: listing.state || 'QLD',
          postcode: listing.postcode,
          type: listing.propertyType,
          beds: listing.beds,
          baths: listing.baths,
          cars: listing.cars,
          price: String(listing.price),
          images: listing.images || [],
          stripeSessionId: session.id,
          status: 'current',
        }),
      });
      const storeResult = await storeRes.json();
      console.log('KV store result:', JSON.stringify(storeResult));
    } else {
      console.warn('LISTING_API_SECRET not set — skipping KV store');
    }

    const publishRes = await fetch(`${base}/api/publish-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing, portal: 'domain' }),
    });
    const result = await publishRes.json();
    console.log('Publish result:', JSON.stringify(result));

    const notConfigured = result?.note?.includes('no FTP credentials configured');
    const publishFailed = result?.success === false;

    // Stage 1 alert: a seller just paid — this IS the onboarding event.
    await notifyAdmin({
      subject: `New seller onboarded — ${listing.address || uniqueId} ($798)`,
      html: `<p><strong>${listing.sellerName || 'A seller'}</strong> (${listing.sellerEmail || 'no email'}, ${listing.sellerPhone || 'no phone'}) just paid for the Complete Listing Package.</p>
<p><strong>Property:</strong> ${listing.address}, ${listing.suburb}<br/>
<strong>Listing ID:</strong> ${uniqueId}<br/>
<strong>Stripe session:</strong> ${session.id}<br/>
<strong>Stripe customer:</strong> ${session.customer || 'n/a'}</p>
<p><strong>Publish to Domain.com.au:</strong> ${publishFailed ? '❌ FAILED — ' + (result.results?.map(r=>r.error).filter(Boolean).join('; ') || 'see logs') : notConfigured ? '⚠️ NOT SENT — FTP credentials not configured, listing is NOT actually live despite the seller being told it is' : '✅ pushed'}</p>`,
      isError: publishFailed || notConfigured,
    });

    if (listing.sellerEmail && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'no-agents.com.au <office@no-agents.com.au>',
          to: [listing.sellerEmail],
          subject: `Your listing is going live — ${listing.address}`,
          html: `<p>Hi ${listing.sellerName || 'there'},</p>
<p>Your payment of $798 has been received. Your Complete Listing Package is being set up now.</p>
<p><strong>Property:</strong> ${listing.address}<br/>
<strong>Listing ID:</strong> ${uniqueId}<br/>
<strong>Price guide:</strong> ${listing.priceView || '$' + Number(listing.price).toLocaleString()}</p>
<p>What happens next:</p>
<ol>
  <li><strong>Today:</strong> Your listing goes live on Domain.com.au</li>
  <li><strong>Within 24 hours:</strong> We'll be in touch to confirm your listing details</li>
  <li><strong>Ongoing:</strong> All enquiries, inspection bookings and offers flow through your seller dashboard</li>
</ol>
<p>Questions? Reply to this email or call 0485 043 210.</p>
<p>— Alexander Bourne<br/>No Agents Pty Ltd · Licence 4542501 (QLD)</p>`,
        }),
      });
    }

    return res.status(200).json({ received: true, uniqueId, publishResult: result });
  } catch (err) {
    console.error('Publish error:', err.message);
    await notifyAdmin({
      subject: `Onboarding pipeline error — ${listing.address || uniqueId}`,
      html: `<p>Payment succeeded (Stripe session ${session.id}) but the KV-store/publish step threw an error.</p>
<p><strong>Error:</strong> ${err.message}</p>
<p>Seller ${listing.sellerName || ''} (${listing.sellerEmail || 'no email'}) may not have a working listing — check manually.</p>`,
      isError: true,
    });
    return res.status(200).json({ received: true, error: err.message });
  }
}
