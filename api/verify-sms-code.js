// api/verify-sms-code.js
// Checks a submitted OTP against the one stored in KV for that phone number.
// Deletes the code on successful match (one-time use).
//
// POST { phone, code }  →  { ok: true } or 400/401
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN

function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (!digits.startsWith('+')) return '+' + digits;
  return raw.trim();
}

async function kvGet(key) {
  const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
  if (!url || !token) return null;
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvDel(key) {
  const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
  if (!url || !token) return;
  await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ error: 'phone and code are required' });

  const to = normalisePhone(phone);
  const stored = await kvGet(`sms:${to}`);

  if (!stored) {
    return res.status(401).json({ error: 'Code expired or not found. Please resend.' });
  }

  if (stored !== code.trim()) {
    return res.status(401).json({ error: 'Incorrect code.' });
  }

  await kvDel(`sms:${to}`);
  return res.status(200).json({ ok: true });
}
