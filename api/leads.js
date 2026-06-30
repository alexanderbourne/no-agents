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

async function kvSet(key, value) {
  await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: value,
  });
}

export default async function handler(req, res) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });
    const raw = await kvGet(`lead:${id}`);
    if (!raw) return res.status(404).json({ error: 'Lead not found' });
    const lead = JSON.parse(raw);
    lead.status = status;
    await kvSet(`lead:${id}`, JSON.stringify(lead));
    return res.status(200).json({ success: true, lead });
  }

  const idsRaw = await kvGet('leads:index');
  let ids = [];
  if (Array.isArray(idsRaw)) {
    ids = idsRaw;
  } else if (typeof idsRaw === 'string' && idsRaw) {
    try { const p = JSON.parse(idsRaw); if (Array.isArray(p)) ids = p; } catch { /* leave [] */ }
  }

  const leads = (await Promise.all(
    ids.map(async id => {
      const raw = await kvGet(`lead:${id}`);
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    })
  )).filter(Boolean);

  return res.status(200).json({ leads });
}
