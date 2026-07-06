// api/referrals.js
// Refer-a-friend program: anyone (not just past sellers) signs up, gets a
// shareable code/link, and earns $100 once someone they referred pays for a
// listing. No automated payout — credits are tracked here and paid manually
// by admin (bank transfer), same as every other money-movement action in
// this app (see api/settle.js). See api/stripe-webhook.js for where a credit
// actually gets created, once payment succeeds.
//
// Public:
//   POST /api/referrals                — sign up as a referrer, get a code
//
// Admin (requires x-admin-token header):
//   GET  /api/referrals                — list all referrers
//   GET  /api/referrals?credits=1      — list all referral credits owed/paid
//   PATCH /api/referrals?creditId=xxx  — mark a credit as paid
//
// Required env vars:
//   KV_REST_API_URL, KV_REST_API_TOKEN  — Vercel KV (Upstash)
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
    body: JSON.stringify(value),
  });
  return r.ok;
}

function safeParse(raw) {
  if (raw === null || raw === undefined) return null;
  let v = raw;
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.value === 'string') {
    try { v = JSON.parse(v.value); } catch {}
  }
  return v;
}

function makeCode() {
  // 6 chars, uppercase letters+digits, no ambiguous 0/O/1/I — easy to read
  // aloud or type from a shared Facebook post.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function getReferral(code) {
  if (!code) return null;
  return safeParse(await kvGet(`referral:${code.trim().toUpperCase()}`));
}

export async function creditReferral({ code, listingId, address }) {
  const referral = await getReferral(code);
  if (!referral) return null;

  referral.totalReferred = (referral.totalReferred || 0) + 1;
  await kvSet(`referral:${referral.code}`, referral);

  const creditId = `credit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const credit = {
    id: creditId,
    code: referral.code,
    referrerName: referral.name,
    referrerEmail: referral.email,
    referrerPhone: referral.phone,
    listingId,
    address,
    amount: 100,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await kvSet(`referral-credit:${creditId}`, credit);
  const existingRaw = await kvGet('referral-credits:all');
  const ids = existingRaw ? JSON.parse(existingRaw) : [];
  ids.push(creditId);
  await kvSet('referral-credits:all', ids);

  return credit;
}

async function getAllReferrals() {
  const raw = await kvGet('referrals:all');
  if (!raw) return [];
  let codes;
  try { codes = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(codes.map(c => kvGet(`referral:${c}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getAllCredits() {
  const raw = await kvGet('referral-credits:all');
  if (!raw) return [];
  let ids;
  try { ids = JSON.parse(raw); } catch { return []; }
  const results = await Promise.all(ids.map(id => kvGet(`referral-credit:${id}`)));
  return results
    .map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ── POST: sign up as a referrer (public) ──────────────────────────────────
  if (req.method === 'POST') {
    const { name, email, phone } = req.body || {};
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email and phone are required' });
    }

    let code, existing;
    do {
      code = makeCode();
      existing = await kvGet(`referral:${code}`);
    } while (existing);

    const referral = {
      code,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      totalReferred: 0,
      createdAt: new Date().toISOString(),
    };
    await kvSet(`referral:${code}`, referral);
    const existingRaw = await kvGet('referrals:all');
    const codes = existingRaw ? JSON.parse(existingRaw) : [];
    codes.push(code);
    await kvSet('referrals:all', codes);

    return res.status(200).json({ ok: true, code, link: `https://www.no-agents.com.au/sell?ref=${code}` });
  }

  // ── GET: list referrals or credits (admin) ──────────────────────────────────
  if (req.method === 'GET') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    if (req.query.credits === '1') {
      return res.status(200).json(await getAllCredits());
    }
    return res.status(200).json(await getAllReferrals());
  }

  // ── PATCH: mark a credit as paid (admin) ────────────────────────────────────
  if (req.method === 'PATCH') {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const { creditId } = req.query;
    if (!creditId) return res.status(400).json({ error: 'creditId query param required' });

    const raw = await kvGet(`referral-credit:${creditId}`);
    if (!raw) return res.status(404).json({ error: 'Credit not found' });

    const credit = JSON.parse(raw);
    credit.status = 'paid';
    credit.paidAt = new Date().toISOString();
    await kvSet(`referral-credit:${creditId}`, credit);

    return res.status(200).json(credit);
  }

  return res.status(405).end();
}
