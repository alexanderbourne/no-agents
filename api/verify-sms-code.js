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

  const { phone, code, token, ts } = req.body || {};
  if (!phone || !code || !token || !ts) {
    return res.status(400).json({ error: 'phone, code, token and ts are required' });
  }

  const to = normalisePhone(phone);

  if (Date.now() - Number(ts) > 10 * 60 * 1000) {
    return res.status(401).json({ error: 'Code expired. Please resend.' });
  }

  const expected = makeToken(code.trim(), to, ts);
  if (expected !== token) {
    return res.status(401).json({ error: 'Incorrect code.' });
  }

  return res.status(200).json({ ok: true });
}
