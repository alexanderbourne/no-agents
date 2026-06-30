// api/seller-auth.js
// Stateless SMS auth for sellers, scoped separately from buyer SMS codes.
//
// POST { phone }                                  → sends a code, returns signed token
// POST ?action=verify { phone, code, token, ts }   → verifies code, issues seller session token
// POST ?action=from-checkout { sessionId, listingId } → verifies a just-completed
//   Stripe Checkout session and issues a seller session token without an OTP step.
//
// Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//                     KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD (HMAC secret),
//                     STRIPE_SECRET_KEY (for ?action=from-checkout)

import twilio from 'twilio';
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'crypto';

const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (!digits.startsWith('+')) return '+' + digits;
  return raw.trim();
}

function makeCodeToken(code, phone, ts) {
  const secret = process.env.ADMIN_PASSWORD || 'no-agents-sms-secret';
  return createHmac('sha256', secret).update(`seller:${code}:${phone}:${ts}`).digest('hex').slice(0, 16);
}

export function makeSellerToken(phone) {
  const secret = process.env.ADMIN_PASSWORD || 'no-agents-seller-secret';
  return createHmac('sha256', secret).update(`no-agents-seller-v1:${normalisePhone(phone)}`).digest('hex');
}

export function verifySellerToken(token, phone) {
  if (!token || !phone) return false;
  const expected = makeSellerToken(phone);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
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

// Tolerant parse: handles an already-deserialized value (object/array), a
// JSON-encoded string, or a legacy double-wrapped `{ value: "<json>" }` shape
// from a since-fixed write-path bug.
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

async function findListingsByPhone(phone) {
  const target = normalisePhone(phone);
  const ids = safeParse(await kvGet('listings:active')) || [];
  const found = [];
  for (const id of ids) {
    const listing = safeParse(await kvGet(`listing:${id}`));
    if (!listing || !listing.sellerPhone) continue;
    if (normalisePhone(listing.sellerPhone) === target) {
      found.push({ id: listing.id, address: listing.address, suburb: listing.suburb, status: listing.status });
    }
  }
  return found;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── Post-checkout: skip the OTP step right after a successful payment ──
  if (req.query.action === 'from-checkout') {
    const { sessionId, listingId } = req.body || {};
    if (!sessionId || !listingId) {
      return res.status(400).json({ error: 'sessionId and listingId are required' });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payments not configured' });
    }

    let session;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return res.status(401).json({ error: 'Invalid checkout session' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(401).json({ error: 'Payment not completed' });
    }
    if ((session.metadata || {}).listingId !== listingId) {
      return res.status(401).json({ error: 'Session does not match listing' });
    }

    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
      return res.status(503).json({ error: 'KV not configured' });
    }
    const listing = safeParse(await kvGet(`listing:${listingId}`));
    if (!listing || !listing.sellerPhone) {
      // Webhook may not have created the listing yet — caller should retry shortly.
      return res.status(202).json({ pending: true });
    }

    const sellerToken = makeSellerToken(listing.sellerPhone);
    return res.status(200).json({ token: sellerToken, listingId: listing.id });
  }

  // ── Verify code, issue session token ──
  if (req.query.action === 'verify') {
    const { phone, code, token, ts } = req.body || {};
    if (!phone || !code || !token || !ts) {
      return res.status(400).json({ error: 'phone, code, token and ts are required' });
    }

    const to = normalisePhone(phone);

    if (Date.now() - Number(ts) > 10 * 60 * 1000) {
      return res.status(401).json({ error: 'Code expired. Please resend.' });
    }

    const expected = makeCodeToken(code.trim(), to, ts);
    if (expected !== token) {
      return res.status(401).json({ error: 'Incorrect code.' });
    }

    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
      return res.status(503).json({ error: 'KV not configured' });
    }

    const listings = await findListingsByPhone(to);
    if (!listings.length) {
      return res.status(404).json({ error: 'No listing found for this phone number. Contact office@no-agents.com.au if you believe this is an error.' });
    }

    const sellerToken = makeSellerToken(to);
    return res.status(200).json({ token: sellerToken, listings });
  }

  // ── Send code ──
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: 'SMS not configured' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const to = normalisePhone(phone);
  const ts = Date.now();
  const token = makeCodeToken(code, to, ts);

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body: `Your no-agents seller dashboard code is: ${code}. Valid for 10 minutes.`,
    });

    return res.status(200).json({ ok: true, token, ts });
  } catch (err) {
    console.error('seller-auth send error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
