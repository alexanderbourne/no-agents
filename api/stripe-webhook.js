// api/stripe-webhook.js
// Handles Stripe checkout.session.completed events.
// bodyParser disabled — raw body required for signature verification.

import Stripe from 'stripe';
import { parseAddress, generateListingId } from './listing-utils.js';
import { notifyAdmin } from './notify-admin.js';
import { notifySeller } from './notify-seller.js';
import { getReferral, creditReferral } from './referrals.js';

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

  // Domain's own photography (Matterport Suite, via their Skylight-booked
  // photographer) takes ~1-2 weeks to deliver from order — the listing must
  // stay off the public feed until photos are actually in hand, regardless of
  // the seller's nominated start date. earliestPublishAt is a hard floor;
  // requestedStartDate (if later) pushes it out further. Either way, going
  // live also requires photoShoot.status === 'completed' — see
  // api/mark-photos-ready.js and api/cron-publish.js.
  const PHOTO_TURNAROUND_DAYS = 7;
  const earliestPublishAt = new Date(Date.now() + PHOTO_TURNAROUND_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const listing = {
    uniqueId,
    tier:                  meta.tier === 'assisted' ? 'assisted' : 'flat',
    inspectionMode:        meta.inspection === 'agent' ? 'agent' : 'self',
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
    // Publish gating — see api/mark-photos-ready.js and api/cron-publish.js
    status:             'pending',
    requestedStartDate: meta.listingStartDate || null,
    earliestPublishAt,
    readyToPublish:     false,
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
          status: listing.status,
          requestedStartDate: listing.requestedStartDate,
          earliestPublishAt: listing.earliestPublishAt,
          readyToPublish: listing.readyToPublish,
        }),
      });
      const storeResult = await storeRes.json();
      console.log('KV store result:', JSON.stringify(storeResult));
    } else {
      console.warn('LISTING_API_SECRET not set — skipping KV store');
    }

    // Referral credit — $100 owed to whoever referred this seller, unless
    // they're referring themselves. No automated payout; this just records
    // what's owed so admin can pay manually (see api/referrals.js).
    let referralCredited = false;
    if (meta.referralCode) {
      const referral = await getReferral(meta.referralCode);
      if (referral && referral.email !== (listing.sellerEmail || '').trim().toLowerCase()) {
        const credit = await creditReferral({ code: meta.referralCode, listingId: listing.uniqueId, address: listing.address });
        referralCredited = Boolean(credit);
        if (credit) {
          await notifyAdmin({
            subject: `$100 referral credit owed — ${referral.name}`,
            html: `<p><strong>${referral.name}</strong> (${referral.email}, ${referral.phone}) referred <strong>${listing.sellerName || listing.address}</strong>, who just paid for a listing at <strong>${listing.address}</strong>.</p>
<p>$100 is now owed to them — pay manually (bank transfer) and mark the credit paid in the admin Referrals tab.</p>`,
          });
        }
      }
    }

    // Do NOT publish yet — the listing sits in "pending" (off the public
    // feed/FTP) until an admin confirms Domain's photography is delivered
    // via /api/mark-photos-ready, which is the only thing that can flip it
    // live. See that file + api/cron-publish.js for the gating logic.
    const startDateNote = listing.requestedStartDate
      ? `nominated start date ${listing.requestedStartDate}`
      : 'no nominated start date (ASAP)';

    // Stage 1 alert: a seller just paid — this IS the onboarding event.
    await notifyAdmin({
      subject: `New seller onboarded — ${listing.address || uniqueId} ($798)`,
      html: `<p><strong>${listing.sellerName || 'A seller'}</strong> (${listing.sellerEmail || 'no email'}, ${listing.sellerPhone || 'no phone'}) just paid for the Complete Listing Package.</p>
<p><strong>Property:</strong> ${listing.address}, ${listing.suburb}<br/>
<strong>Listing ID:</strong> ${uniqueId}<br/>
<strong>Stripe session:</strong> ${session.id}<br/>
<strong>Stripe customer:</strong> ${session.customer || 'n/a'}</p>
<p><strong>Publish to Domain.com.au:</strong> ⏳ HELD — not published yet. Book Domain photography (Skylight/Matterport) for this address, then use the admin dashboard "Listings" tab to mark photos ready once delivered. Seller ${startDateNote}; earliest allowed publish date ${new Date(listing.earliestPublishAt).toLocaleDateString('en-AU')} (7-day photography floor).</p>`,
      isError: false,
    });

    await notifySeller({
      listing,
      subject: `Your listing is being set up — ${listing.address}`,
      html: `<p>Hi ${listing.sellerName || 'there'},</p>
<p>Your payment of $798 has been received. Your Complete Listing Package is being set up now.</p>
<p><strong>Property:</strong> ${listing.address}<br/>
<strong>Listing ID:</strong> ${uniqueId}<br/>
<strong>Price guide:</strong> ${listing.priceView || '$' + Number(listing.price).toLocaleString()}</p>
<p>What happens next:</p>
<ol>
  <li><strong>Within 24 hours:</strong> We'll be in touch to confirm your listing details and book professional photography.</li>
  <li><strong>~1 week:</strong> Domain's photographer completes your shoot (Matterport 3D tour, photos, floor plan).</li>
  <li><strong>Then live:</strong> Once photos are in hand${listing.requestedStartDate ? `, your listing goes live on Domain.com.au on or after your requested date of ${listing.requestedStartDate}` : ', your listing goes live on Domain.com.au — we never publish an ad before the photos are ready'}.</li>
  <li><strong>Ongoing:</strong> All enquiries, inspection bookings and offers flow through your seller dashboard once live.</li>
</ol>
<p>Questions? Reply to this email or call 0485 043 210.</p>
<p>— Alexander Bourne<br/>No Agents Pty Ltd · Licence 4542501 (QLD)</p>`,
      sms: `No Agents: Payment received for ${listing.address}. We'll be in touch within 24 hours to book photography — your listing goes live once photos are ready.`,
    });

    return res.status(200).json({ received: true, uniqueId, status: listing.status });
  } catch (err) {
    console.error('Onboarding error:', err.message);
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
