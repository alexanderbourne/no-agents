// api/mortgage-broker.js
// Buyer-side finance referral. Unlike the conveyancing partner, this
// relationship isn't sensitive to name — the broker's contact details still
// live in env vars (not hardcoded) purely so they can be updated without a
// code change, not to hide who they are.
//
// Surfaced to buyers who have a finance condition on their offer (see
// index.html ContractSign) via api/contract.js action=request-mortgage-broker,
// which also calls logMortgageReferral() below to track it for the admin
// dashboard (GET this file directly, admin-token protected).
//
// Required env vars: DEFAULT_MORTGAGE_BROKER_EMAIL, DEFAULT_MORTGAGE_BROKER_NAME (optional),
//                     RESEND_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_PASSWORD

import { verifyAdminToken } from './admin-auth.js';

const { RESEND_API_KEY, DEFAULT_MORTGAGE_BROKER_EMAIL, DEFAULT_MORTGAGE_BROKER_NAME } = process.env;

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

export function getMortgageBroker() {
  if (!DEFAULT_MORTGAGE_BROKER_EMAIL) return null;
  return { name: DEFAULT_MORTGAGE_BROKER_NAME || null, email: DEFAULT_MORTGAGE_BROKER_EMAIL };
}

export async function notifyMortgageBroker({ buyerName, buyerEmail, buyerPhone, address }) {
  const broker = getMortgageBroker();
  if (!RESEND_API_KEY || !broker?.email) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents <office@no-agents.com.au>',
        to: [broker.email],
        subject: `Finance referral — ${buyerName || 'a buyer'} (${address})`,
        html: `<div style="font-family:sans-serif;max-width:500px;">
          <h2>New finance referral</h2>
          <p>A buyer on no-agents.com.au has a finance condition on their accepted offer for <strong>${address}</strong> and asked to be connected with a broker.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr><td style="padding:6px 12px;color:#666;width:100px;">Name</td><td style="padding:6px 12px;font-weight:600;">${buyerName || '—'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Email</td><td style="padding:6px 12px;">${buyerEmail || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Phone</td><td style="padding:6px 12px;">${buyerPhone || '—'}</td></tr>
          </table>
          <p style="font-size:12px;color:#999;">Sent automatically by no-agents.com.au. Reply directly to the buyer to proceed.</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('notifyMortgageBroker failed:', e.message);
    return false;
  }
}

// Tracks every referral fired, for the admin dashboard gadget — separate from
// the per-listing contract.mortgageBrokerRequested flag, which only tells you
// whether THAT listing has one, not the running list/count across all of them.
export async function logMortgageReferral({ listingId, address, buyerName, buyerEmail, buyerPhone, sent }) {
  const id = `mtgref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = { id, listingId, address, buyerName, buyerEmail, buyerPhone, sent, createdAt: new Date().toISOString() };
  await kvSet(`mortgage-referral:${id}`, record);
  const existingRaw = await kvGet('mortgage-referrals:all');
  const ids = existingRaw ? JSON.parse(existingRaw) : [];
  ids.push(id);
  await kvSet('mortgage-referrals:all', ids);
  return record;
}

async function getAllMortgageReferrals() {
  const raw = await kvGet('mortgage-referrals:all');
  if (!raw) return [];
  let ids;
  try { ids = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(ids.map(id => kvGet(`mortgage-referral:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// GET /api/mortgage-broker — admin-only list of every referral fired (dashboard gadget)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const token = (req.headers['x-admin-token'] || '').trim();
  if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json(await getAllMortgageReferrals());
}
