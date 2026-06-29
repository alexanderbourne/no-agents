// api/agents.js
// Agent panel application management.
//
// Public:
//   POST /api/agents          — submit application (from the Agents page form)
//
// Admin (requires x-admin-token header):
//   GET  /api/agents          — list all agents
//   PATCH /api/agents?id=xxx  — update status (pending → approved | suspended)
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN  — Vercel KV (Upstash)
//   RESEND_API_KEY                       — email notifications
//   ADMIN_PASSWORD                       — verified via admin-auth.js

import { verifyAdminToken } from './admin-auth.js';

// ── KV helpers ───────────────────────────────────────────────────────────────

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

async function kvSet(key, value) {
  const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
  if (!url || !token) return false;
  const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
  return r.ok;
}

async function getAllAgents() {
  const raw = await kvGet('agents:all');
  if (!raw) return [];
  let ids;
  try { ids = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(ids.map(id => kvGet(`agent:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ── POST: submit application (public) ──────────────────────────────────────
  if (req.method === 'POST') {
    const { name, email, phone, licence, suburb, message, licenceFileData, licenceFileName } = req.body || {};

    if (!name || !email || !phone || !licence) {
      return res.status(400).json({ error: 'name, email, phone and licence are required' });
    }

    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const agent = {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      licence: licence.trim(),
      suburb: (suburb || '').trim(),
      message: (message || '').trim(),
      licenceFileName: licenceFileName || null,
      licenceFileData: licenceFileData || null,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };

    await kvSet(`agent:${id}`, agent);
    const existingRaw = await kvGet('agents:all');
    const ids = existingRaw ? JSON.parse(existingRaw) : [];
    if (!ids.includes(id)) ids.push(id);
    await kvSet('agents:all', ids);

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'no-agents.com.au <office@no-agents.com.au>',
          to: ['office@no-agents.com.au'],
          subject: `⚡ New agent application — ${agent.name}`,
          html: `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">New panel application</h2>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;width:120px;">Name</td><td style="padding:6px 12px;font-size:14px;font-weight:600;">${agent.name}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Email</td><td style="padding:6px 12px;font-size:14px;">${agent.email}</td></tr>
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;">Phone</td><td style="padding:6px 12px;font-size:14px;">${agent.phone}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Licence</td><td style="padding:6px 12px;font-size:14px;font-weight:600;">${agent.licence}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Suburbs</td><td style="padding:6px 12px;font-size:14px;">${agent.suburb || '—'}</td></tr>
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;">Licence file</td><td style="padding:6px 12px;font-size:14px;">${agent.licenceFileName || 'Not uploaded'}</td></tr>
    ${agent.message ? `<tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Message</td><td style="padding:6px 12px;font-size:14px;font-style:italic;">"${agent.message}"</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#999;margin-top:16px;">Approve or suspend via the admin panel (⚙ in footer).</p>
</div>`,
        }),
      }).catch(e => console.error('Agent email error:', e));
    }

    return res.status(200).json({ ok: true, id });
  }

  // ── GET: list all agents (admin) ────────────────────────────────────────────
  if (req.method === 'GET') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const agents = await getAllAgents();
    return res.status(200).json(agents);
  }

  // ── PATCH: update agent status (admin) ──────────────────────────────────────
  if (req.method === 'PATCH') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    const { status, notes } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const raw = await kvGet(`agent:${id}`);
    if (!raw) return res.status(404).json({ error: 'Agent not found' });

    const agent = JSON.parse(raw);
    if (status) agent.status = status;
    if (notes !== undefined) agent.notes = notes;
    if (status === 'approved' && !agent.approvedAt) {
      agent.approvedAt = new Date().toISOString();
    }
    await kvSet(`agent:${id}`, agent);

    if (status === 'approved' && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'no-agents.com.au <office@no-agents.com.au>',
          to: [agent.email],
          subject: 'Welcome to the no-agents panel',
          html: `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">You're on the panel, ${agent.name}.</h2>
  <p style="font-size:15px;color:#4a4540;line-height:1.75;">Your application to join the no-agents inspection panel has been approved. Welcome.</p>
  <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin:24px 0;">
    <p style="color:#e8d5b0;font-size:15px;font-weight:600;margin:0 0 16px;">How it works:</p>
    <p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.75;margin:0 0 8px;">1. You'll receive booking notifications by email and SMS.</p>
    <p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.75;margin:0 0 8px;">2. Each confirmed inspection = <strong style="color:#e8d5b0;">$70</strong>, paid every Friday.</p>
    <p style="color:rgba(255,255,255,.7);font-size:14px;line-height:1.75;margin:0;">3. 30–45 mins per visit. Show up, show through, lock up.</p>
  </div>
  <p style="font-size:14px;color:#4a4540;">Questions? Reply to this email or call <strong>0485 043 210</strong>.</p>
  <p style="font-size:14px;color:#4a4540;">— Alexander Bourne<br/>No Agents Pty Ltd · Licence 4542501 (QLD)</p>
</div>`,
        }),
      }).catch(e => console.error('Approval email error:', e));
    }

    return res.status(200).json(agent);
  }

  return res.status(405).end();
}
