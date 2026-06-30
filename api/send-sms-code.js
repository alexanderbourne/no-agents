import twilio from 'twilio';
import { createHmac } from 'crypto';

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (!digits.startsWith('+')) return '+' + digits;
  return raw.trim();
}

function makeToken(code, phone, ts) {
  const secret = process.env.ADMIN_PASSWORD || 'no-agents-sms-secret';
  return createHmac('sha256', secret).update(`${code}:${phone}:${ts}`).digest('hex').slice(0, 16);
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
  const ts = Date.now();
  const token = makeToken(code, to, ts);

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body: `Your no-agents verification code is: ${code}. Valid for 10 minutes.`,
    });

    // Return signed token to client — no KV needed
    return res.status(200).json({ ok: true, token, ts });
  } catch (err) {
    console.error('send-sms-code error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
