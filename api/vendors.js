// api/vendors.js
// Marketplace vendor directory — building & pest inspectors and stylists/
// stagers who want to be listed to no-agents sellers and buyers.
//
// v1 scope: directory only. No booking flow, no take-rate/commission billing —
// approved vendors' contact details are shown directly so sellers/buyers reach
// out themselves. Modelled on api/agents.js (same KV shape, same admin-token
// approval flow) so it's a known pattern rather than a new one.
//
// Public:
//   POST /api/vendors                — self-serve signup (status starts 'pending')
//   GET  /api/vendors                — directory: approved vendors only
//
// Admin (requires x-admin-token header):
//   GET  /api/vendors?all=1          — every vendor, any status
//   PATCH /api/vendors?id=xxx        — update status (pending → approved | suspended)
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN  — Vercel KV (Upstash)
//   RESEND_API_KEY                       — email notifications (optional)
//   ADMIN_PASSWORD                       — verified via admin-auth.js

import { verifyAdminToken } from './admin-auth.js';

const CATEGORIES = ['inspection', 'styling'];

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
    body: JSON.stringify(value),
  });
  return r.ok;
}

async function getAllVendors() {
  const raw = await kvGet('vendors:all');
  if (!raw) return [];
  let ids;
  try { ids = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(ids.map(id => kvGet(`vendor:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
}

function publicView(v) {
  return {
    id: v.id,
    category: v.category,
    businessName: v.businessName,
    contactName: v.contactName,
    email: v.email,
    phone: v.phone,
    serviceArea: v.serviceArea,
    portfolioUrl: v.portfolioUrl,
    message: v.message,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ── POST: self-serve signup (public) ──────────────────────────────────────
  if (req.method === 'POST') {
    const { category, businessName, contactName, email, phone, serviceArea, licenceOrCert, portfolioUrl, message } = req.body || {};

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!businessName || !contactName || !email || !phone) {
      return res.status(400).json({ error: 'businessName, contactName, email and phone are required' });
    }

    const id = `vendor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const vendor = {
      id,
      category,
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      serviceArea: (serviceArea || '').trim(),
      licenceOrCert: (licenceOrCert || '').trim(),
      portfolioUrl: (portfolioUrl || '').trim(),
      message: (message || '').trim(),
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };

    await kvSet(`vendor:${id}`, vendor);
    const existingRaw = await kvGet('vendors:all');
    const ids = existingRaw ? JSON.parse(existingRaw) : [];
    if (!ids.includes(id)) ids.push(id);
    await kvSet('vendors:all', ids);

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
          subject: `⚡ New vendor application — ${vendor.businessName} (${vendor.category})`,
          html: `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">New vendor directory application</h2>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;width:130px;">Category</td><td style="padding:6px 12px;font-size:14px;font-weight:600;">${vendor.category === 'inspection' ? 'Building & pest' : 'Styling & staging'}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Business</td><td style="padding:6px 12px;font-size:14px;font-weight:600;">${vendor.businessName}</td></tr>
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;">Contact</td><td style="padding:6px 12px;font-size:14px;">${vendor.contactName}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Email</td><td style="padding:6px 12px;font-size:14px;">${vendor.email}</td></tr>
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;">Phone</td><td style="padding:6px 12px;font-size:14px;">${vendor.phone}</td></tr>
    <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Service area</td><td style="padding:6px 12px;font-size:14px;">${vendor.serviceArea || '—'}</td></tr>
    <tr><td style="padding:6px 12px;color:#666;font-size:14px;">Licence/cert</td><td style="padding:6px 12px;font-size:14px;">${vendor.licenceOrCert || '—'}</td></tr>
    ${vendor.portfolioUrl ? `<tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;font-size:14px;">Portfolio</td><td style="padding:6px 12px;font-size:14px;">${vendor.portfolioUrl}</td></tr>` : ''}
    ${vendor.message ? `<tr><td style="padding:6px 12px;color:#666;font-size:14px;">Message</td><td style="padding:6px 12px;font-size:14px;font-style:italic;">"${vendor.message}"</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#999;margin-top:16px;">Approve or suspend via the admin panel (Vendors tab).</p>
</div>`,
        }),
      }).catch(e => console.error('Vendor application email error:', e));
    }

    return res.status(200).json({ ok: true, id });
  }

  // ── GET: directory (public, approved-only) or full list (admin) ────────────
  if (req.method === 'GET') {
    const wantsAll = req.query.all === '1';
    if (wantsAll) {
      const adminToken = (req.headers['x-admin-token'] || '').trim();
      if (!verifyAdminToken(adminToken)) return res.status(401).json({ error: 'Unauthorized' });
      const vendors = await getAllVendors();
      return res.status(200).json(vendors);
    }

    const vendors = (await getAllVendors()).filter(v => v.status === 'approved');
    return res.status(200).json(vendors.map(publicView));
  }

  // ── PATCH: update vendor status (admin) ─────────────────────────────────────
  if (req.method === 'PATCH') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    const { status, notes } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const raw = await kvGet(`vendor:${id}`);
    if (!raw) return res.status(404).json({ error: 'Vendor not found' });

    const vendor = JSON.parse(raw);
    if (status) vendor.status = status;
    if (notes !== undefined) vendor.notes = notes;
    if (status === 'approved' && !vendor.approvedAt) {
      vendor.approvedAt = new Date().toISOString();
    }
    await kvSet(`vendor:${id}`, vendor);

    if (status === 'approved' && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'no-agents.com.au <office@no-agents.com.au>',
          to: [vendor.email],
          subject: "You're listed on the no-agents vendor directory",
          html: `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">You're live, ${vendor.contactName}.</h2>
  <p style="font-size:15px;color:#4a4540;line-height:1.75;">${vendor.businessName} is now listed on the no-agents vendor directory under ${vendor.category === 'inspection' ? 'Building & Pest Inspections' : 'Styling & Staging'}. Sellers and buyers can now find and contact you directly.</p>
  <p style="font-size:14px;color:#4a4540;">Questions? Reply to this email or call <strong>0485 043 210</strong>.</p>
  <p style="font-size:14px;color:#4a4540;">— Alexander Bourne<br/>No Agents Pty Ltd · Licence 4542501 (QLD)</p>
</div>`,
        }),
      }).catch(e => console.error('Vendor approval email error:', e));
    }

    return res.status(200).json(vendor);
  }

  return res.status(405).end();
}
