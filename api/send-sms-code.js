// api/send-sms-code.js
// Generates a 6-digit OTP, stores it in Vercel KV with 10-min expiry,
// and sends it to the buyer's phone via Twilio SMS.
//
// POST { phone }  →  { ok: true }
//
// Required env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
//   KV_REST_API_URL, KV_REST_API_TOKEN

import twilio from 'twilio';

const KV_TTL = 600; // 10 minutes

async function kvSet(key, value) {
  const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
  if (!url || !token) throw new Error('KV not configured');
  await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, ex: KV_TTL }),
  });
}

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (!digits.startsWith('+')) return '+' + digits;
  return raw.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: 'SMS not configured' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const to = normalisePhone(phone);

  try {
    await kvSet(`sms:${to}`, code);

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body: `Your no-agents verification code is: ${code}. Valid for 10 minutes.`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-sms-code error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
