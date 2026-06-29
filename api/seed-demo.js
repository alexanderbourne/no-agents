const { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: KV_TOKEN } = process.env;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvRawSet(key, rawValue) {
  // Upstash REST: POST /set/key with body as the raw string value
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
    body: rawValue,
  });
}

async function kvSet(key, value) {
  await kvRawSet(key, JSON.stringify(value));
}

async function kvDel(key) {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

import { verifyAdminToken } from './admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers['x-admin-token'] || '';
  if (!verifyAdminToken(token) && req.headers['x-api-secret'] !== process.env.LISTING_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const agentId = 'agent-demo-jane';
  const agent = {
    id: agentId,
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '0400000000',
    licence: '1234567',
    agencyLicence: '4542501',
    suburb: 'West End, South Brisbane',
    message: 'Available weekends, inner-south suburbs.',
    status: 'approved',
    appliedAt: '2026-06-25T10:00:00.000Z',
    approvedAt: '2026-06-26T09:00:00.000Z',
  };
  await kvSet(`agent:${agentId}`, agent);

  // Reset agents index to fix any corruption, then rebuild
  await kvDel('agents:all');
  await kvSet('agents:all', [agentId]);

  const reqId = 'req-demo-1';
  const inspReq = {
    id: reqId,
    address: '8/100 Boundary Street, West End QLD 4101',
    date: 'Sat 5 Jul',
    time: '10:00am',
    buyerName: 'Michael Torres',
    notes: 'Ground floor unit, access via Boundary St entrance.',
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  await kvSet(`inspection-req:${reqId}`, inspReq);

  await kvDel('inspections:available');
  await kvSet('inspections:available', [reqId]);

  return res.status(200).json({
    ok: true,
    message: 'Demo data seeded',
    agentLogin: { email: 'jane@example.com', phone: '0400000000' },
    portalUrl: 'https://www.no-agents.com.au/portal',
  });
}
