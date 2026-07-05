// api/eoi-list.js — Admin listing of stored expressions of interest.
//
// GET /api/eoi-list
// Headers: x-admin-token: <ADMIN_TOKEN>
// Optional: ?source=out-of-area | fractional
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

import { verifyAdminToken } from './admin-auth.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

async function kvGet(key) {
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!verifyAdminToken(req.headers['x-admin-token'] || req.query.token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  const ids = Array.isArray(await kvGet('eoi:all')) ? await kvGet('eoi:all') : [];

  let eois = (await Promise.all(ids.map(id => kvGet(`eoi:${id}`)))).filter(Boolean);

  const { source } = req.query || {};
  if (source) eois = eois.filter(e => e.source === source);

  eois.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({ eois });
}
