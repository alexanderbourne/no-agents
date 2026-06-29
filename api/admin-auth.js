// api/admin-auth.js
// Stateless admin authentication via HMAC token.
//
// POST { password } → { token }
// Token = HMAC-SHA256(ADMIN_PASSWORD, 'no-agents-admin-v1') — stateless, no KV needed.
// verifyAdminToken() is a named export used by agents.js and inspections.js.
//
// Required env var: ADMIN_PASSWORD

import crypto from 'crypto';

const HMAC_SECRET = 'no-agents-admin-v1';

function makeToken(password) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(password).digest('hex');
}

export function verifyAdminToken(token) {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw || !token) return false;
  const expected = makeToken(adminPw);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const adminPw = process.env.ADMIN_PASSWORD;

  if (!adminPw) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD env var not set' });
  }

  if (!password || password !== adminPw) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  return res.status(200).json({ token: makeToken(adminPw) });
}
