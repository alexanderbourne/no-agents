// api/inspections.js
// Inspection recording and commission tracking.
//
// Internal (called by Dash when an inspection is confirmed):
//   POST /api/inspections — record a confirmed inspection
//
// Admin (requires x-admin-token header):
//   GET  /api/inspections          — list all inspections
//   PATCH /api/inspections?id=xxx  — mark commission paid
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN  — Vercel KV (Upstash)
//   ADMIN_PASSWORD                       — verified via admin-auth.js

import { verifyAdminToken } from './admin-auth.js';
import { chargeInspectionVisit, findListingByAddress } from './inspection-billing.js';
import { notifyAdmin } from './notify-admin.js';
import { notifySeller } from './notify-seller.js';

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

async function getAllInspections() {
  const raw = await kvGet('inspections:all');
  if (!raw) return [];
  let ids;
  try { ids = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(ids.map(id => kvGet(`inspection:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ── POST: record inspection or create available request ─────────────────
  if (req.method === 'POST') {
    const { type } = req.query;

    // POST ?type=request — create an available inspection (public from buyer booking or admin)
    if (type === 'request') {
      const { address, date, time, buyerName, notes } = req.body || {};
      if (!address || !date) return res.status(400).json({ error: 'address and date are required' });

      // Only listings that opted into agent-assisted visits may generate an
      // agent-claimable (paid, $70 commission) request. Self-facilitate
      // listings — and listings we can't find, or that predate the
      // inspectionMode field — default to the safe "not agent" path so a
      // buyer booking never turns into an unearned agent payout.
      const listing = await findListingByAddress(address);
      if (!listing || listing.inspectionMode !== 'agent') {
        let notified = { emailed: false, texted: false };
        if (listing) {
          notified = await notifySeller({
            listing,
            subject: `Inspection request — ${address}`,
            html: `<div style="font-family:sans-serif;max-width:500px;">
              <h2 style="color:#1a1a1a;margin-bottom:16px">A buyer wants to inspect your property</h2>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:8px 12px;color:#666;width:100px">Date</td><td style="padding:8px 12px;font-weight:600">${date}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:8px 12px;color:#666">Time</td><td style="padding:8px 12px">${time || 'TBC'}</td></tr>
                ${buyerName ? `<tr><td style="padding:8px 12px;color:#666">Buyer</td><td style="padding:8px 12px">${buyerName}</td></tr>` : ''}
              </table>
              <p style="margin-top:20px">You've chosen to self-facilitate inspections for this listing, so reach out directly to arrange access.</p>
            </div>`,
            sms: `No Agents: A buyer wants to inspect ${address} on ${date}${time ? ` at ${time}` : ''}. You self-facilitate this listing — please arrange access directly.`,
          });
        }
        await notifyAdmin({
          subject: `Inspection request (self-facilitate) — ${address}`,
          html: `<p><strong>${(buyerName || 'A buyer').trim()}</strong> requested an inspection at <strong>${address}</strong> on ${date}${time ? ` at ${time}` : ''}.</p>
<p>This listing is self-facilitate${listing ? '' : ' (listing not found)'}, so no agent-claimable request was created. ${notified.emailed ? 'Seller was emailed directly.' : notified.texted ? 'Seller was texted directly (no email on file or email failed).' : 'Could not reach the seller by email or SMS — follow up manually.'}</p>`,
        });
        return res.status(200).json({ ok: true, mode: 'self' });
      }

      const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const request = { id, address, date, time: time || '', buyerName: (buyerName || '').trim(), notes: (notes || '').trim(), status: 'open', createdAt: new Date().toISOString() };
      await kvSet(`inspection-req:${id}`, request);

      const existingRaw = await kvGet('inspections:available');
      let ids = [];
      if (Array.isArray(existingRaw)) {
        ids = existingRaw;
      } else if (typeof existingRaw === 'string' && existingRaw) {
        try { const p = JSON.parse(existingRaw); if (Array.isArray(p)) ids = p; } catch { /* leave [] */ }
      }
      ids.push(id);
      await kvSet('inspections:available', ids);

      // Email all approved agents
      if (process.env.RESEND_API_KEY) {
        try {
          const agentsRaw = await kvGet('agents:all');
          const agentIds = agentsRaw ? JSON.parse(agentsRaw) : [];
          const approvedEmails = [];
          for (const aid of agentIds) {
            const agRaw = await kvGet(`agent:${aid}`);
            if (!agRaw) continue;
            const ag = JSON.parse(agRaw);
            if (ag.status === 'approved' && ag.email) approvedEmails.push(ag.email);
          }
          if (approvedEmails.length) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'No Agents <office@no-agents.com.au>',
                to: approvedEmails,
                subject: `New inspection available — ${address}`,
                html: `<div style="font-family:sans-serif;max-width:500px;">
                  <h2 style="color:#1a1a1a;margin-bottom:16px">New inspection to claim</h2>
                  <table style="border-collapse:collapse;width:100%;">
                    <tr><td style="padding:8px 12px;color:#666;width:100px">Address</td><td style="padding:8px 12px;font-weight:600">${address}</td></tr>
                    <tr style="background:#f9f9f9"><td style="padding:8px 12px;color:#666">Date</td><td style="padding:8px 12px">${date}</td></tr>
                    <tr><td style="padding:8px 12px;color:#666">Time</td><td style="padding:8px 12px">${time || 'TBC'}</td></tr>
                    ${buyerName ? `<tr style="background:#f9f9f9"><td style="padding:8px 12px;color:#666">Buyer</td><td style="padding:8px 12px">${buyerName}</td></tr>` : ''}
                  </table>
                  <p style="margin-top:20px"><a href="https://www.no-agents.com.au/portal" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">Claim this inspection — $70</a></p>
                  <p style="font-size:12px;color:#999;margin-top:16px">First in, best dressed. Log in to claim.</p>
                </div>`,
              }),
            }).catch(e => console.error('Agent notification error:', e));
          }
        } catch (e) { console.error('Agent email lookup error:', e); }
      }

      return res.status(200).json({ ok: true, mode: 'agent', id, request });
    }

    // POST — record a confirmed inspection (from Dash)
    const { agentId, agentName, agentEmail, listingAddress, listingId, date, time, buyerName } = req.body || {};

    if (!agentName || !listingAddress || !date) {
      return res.status(400).json({ error: 'agentName, listingAddress and date are required' });
    }

    const id = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const billing = await chargeInspectionVisit({ listingId, address: listingAddress, inspectionId: id });
    const inspection = {
      id,
      agentId:         agentId || null,
      agentName:       agentName.trim(),
      agentEmail:      (agentEmail || '').trim(),
      listingAddress:  listingAddress.trim(),
      listingId:       listingId || null,
      date,
      time:            time || '',
      buyerName:       (buyerName || '').trim(),
      status:          'confirmed',
      commissionOwed:  70,
      commissionPaid:  false,
      sellerFee:       99,
      sellerFeeCharged: billing.charged,
      sellerFeeChargeId: billing.chargeId || null,
      sellerFeeSkipReason: billing.charged ? null : billing.reason,
      recordedAt:      new Date().toISOString(),
    };

    await kvSet(`inspection:${id}`, inspection);
    const existingRaw = await kvGet('inspections:all');
    let ids = [];
    if (Array.isArray(existingRaw)) {
      ids = existingRaw;
    } else if (typeof existingRaw === 'string' && existingRaw) {
      try { const p = JSON.parse(existingRaw); if (Array.isArray(p)) ids = p; } catch { /* leave [] */ }
    }
    ids.push(id);
    await kvSet('inspections:all', ids);

    if (billing.listing) {
      await notifySeller({
        listing: billing.listing,
        subject: `Inspection confirmed — ${listingAddress}`,
        html: `<div style="font-family:sans-serif;max-width:500px;">
          <h2 style="color:#1a1a1a;margin-bottom:16px">A licensed agent will attend your property</h2>
          <p><strong>${inspection.agentName}</strong> will attend <strong>${listingAddress}</strong> on ${date}${time ? ` at ${time}` : ''}${buyerName ? ` to show ${buyerName} through` : ''}.</p>
        </div>`,
        sms: `No Agents: Agent ${inspection.agentName} will attend ${listingAddress} on ${date}${time ? ` at ${time}` : ''}.`,
      });
    }

    return res.status(200).json({ ok: true, id });
  }

  // ── GET: list all inspections (admin) ─────────────────────────────────────
  if (req.method === 'GET') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const inspections = await getAllInspections();
    return res.status(200).json(inspections);
  }

  // ── PATCH: mark commission paid (admin) ────────────────────────────────────
  if (req.method === 'PATCH') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const raw = await kvGet(`inspection:${id}`);
    if (!raw) return res.status(404).json({ error: 'Inspection not found' });

    const inspection = JSON.parse(raw);
    inspection.commissionPaid = true;
    inspection.paidAt = new Date().toISOString();
    await kvSet(`inspection:${id}`, inspection);

    return res.status(200).json(inspection);
  }

  return res.status(405).end();
}
