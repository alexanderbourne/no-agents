// api/notify-seller.js
// Shared helper: notify a listing's seller at each real stage of their
// transaction (new enquiry-driven booking, inspection confirmed, offer
// received, contract signed, settlement, etc).
//
// Sends email via Resend when a seller email + RESEND_API_KEY are available.
// Falls back to SMS via Twilio (same account already used for OTP codes in
// send-sms-code.js) whenever the email couldn't be sent — no seller email on
// file, RESEND_API_KEY not configured, or the Resend call itself fails — so
// a seller is never left uninformed just because one channel is down.
//
// Usage:
//   import { notifySeller } from './notify-seller.js';
//   await notifySeller({ listing, subject: '...', html: '...', sms: '...' });
//
// Never throws — a notification failure must not break the calling request.

import twilio from 'twilio';

const { RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

function normalisePhone(raw) {
  const trimmed = (raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (trimmed.startsWith('+')) return trimmed;
  return '+' + digits;
}

async function sendEmail(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'No Agents <office@no-agents.com.au>', to: [to], subject, html }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Resend ${r.status}: ${body}`);
  }
}

async function sendSms(to, body) {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  await client.messages.create({ to, from: TWILIO_PHONE_NUMBER, body });
}

// { listing, subject, html, sms? } — `sms` is a short plain-text fallback
// body used only when email isn't sent; defaults to `subject` if omitted.
export async function notifySeller({ listing, subject, html, sms }) {
  const result = { emailed: false, texted: false };
  if (!listing) return result;

  if (listing.sellerEmail && RESEND_API_KEY) {
    try {
      await sendEmail(listing.sellerEmail, subject, html);
      result.emailed = true;
    } catch (e) {
      console.error('notifySeller — email failed, will try SMS fallback:', e.message);
    }
  }

  if (!result.emailed && listing.sellerPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    const to = normalisePhone(listing.sellerPhone);
    if (to) {
      try {
        await sendSms(to, sms || `No Agents: ${subject}`);
        result.texted = true;
      } catch (e) {
        console.error('notifySeller — SMS fallback failed:', e.message);
      }
    }
  }

  if (!result.emailed && !result.texted) {
    console.warn(`notifySeller — could not reach seller for "${subject}" (no email/SMS channel available or all failed)`);
  }

  return result;
}
