// api/mark-photos-ready.js — Admin confirms Domain's photography is delivered.
//
// This is the ONLY thing that can take a listing from "pending" to "current"
// (i.e. visible in api/feed.js and eligible for the FTP push in
// api/publish-listing.js). Domain provides photography themselves (Platinum
// Edge + Matterport, booked via their Skylight app) — there's no webhook
// telling us when a shoot is done, so an admin confirms it here once the
// final image URLs are in hand and attaches them to the listing.
//
// Even after this call, the listing only goes fully live once the greater of:
//   - listing.earliestPublishAt (7-day photography floor set at checkout), and
//   - listing.requestedStartDate (seller's nominated go-live date, if any)
// has arrived. If that date is still in the future, the listing is flagged
// readyToPublish so api/cron-publish.js can flip it live automatically once
// the date arrives.
//
// POST /api/mark-photos-ready
// Headers: x-admin-token: <ADMIN_TOKEN>
// Body: { listingId: string, images: string[] }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

import { verifyAdminToken } from './admin-auth.js';
import { notifyAdmin } from './notify-admin.js';
import { notifySeller } from './notify-seller.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

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

async function kvGet(key) {
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error(`KV set failed for ${key}: ${r.status}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!verifyAdminToken(req.headers['x-admin-token'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  const { listingId, images } = req.body || {};
  if (!listingId) return res.status(400).json({ error: 'listingId is required' });
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'At least one image URL is required to mark photos ready' });
  }

  const listing = safeParse(await kvGet(`listing:${listingId}`));
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const now = new Date();
  listing.images = images;
  listing.photoShoot = {
    ...(listing.photoShoot || {}),
    status: 'completed',
    completedAt: now.toISOString(),
  };

  const candidates = [listing.earliestPublishAt, listing.requestedStartDate]
    .filter(Boolean)
    .map(d => new Date(d));
  const effectivePublishAt = candidates.length
    ? new Date(Math.max(...candidates.map(d => d.getTime())))
    : now;

  const goesLiveNow = effectivePublishAt <= now;

  if (goesLiveNow) {
    listing.status = 'current';
    listing.readyToPublish = false;
    listing.publishedAt = now.toISOString();
  } else {
    listing.readyToPublish = true;
  }

  await kvSet(`listing:${listingId}`, listing);

  let publishResult = null;
  if (goesLiveNow) {
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://no-agents.com.au';
      const publishRes = await fetch(`${base}/api/publish-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing, portal: 'domain' }),
      });
      publishResult = await publishRes.json();
    } catch (e) {
      console.error('[mark-photos-ready] publish-listing call failed:', e.message);
    }
  }

  await notifyAdmin({
    subject: goesLiveNow
      ? `Listing live — ${listing.address}`
      : `Photos ready, scheduled — ${listing.address}`,
    html: goesLiveNow
      ? `<p>Photos confirmed for <strong>${listing.address}</strong> and it just went live on Domain.com.au (and REAXML feed).</p>`
      : `<p>Photos confirmed for <strong>${listing.address}</strong>. It will go live automatically on ${effectivePublishAt.toLocaleDateString('en-AU')} (the seller's nominated date) — no action needed until then.</p>`,
  });

  await notifySeller({
    listing,
    subject: goesLiveNow ? `Your listing is now live — ${listing.address}` : `Photos are in — ${listing.address}`,
    html: goesLiveNow
      ? `<p>Hi ${listing.sellerName || 'there'},</p><p>Your professional photos are in and <strong>${listing.address}</strong> just went live on Domain.com.au. Enquiries, inspections and offers will now flow through your seller dashboard.</p>`
      : `<p>Hi ${listing.sellerName || 'there'},</p><p>Your professional photos for <strong>${listing.address}</strong> are ready. As requested, your listing will go live on Domain.com.au on ${effectivePublishAt.toLocaleDateString('en-AU')}.</p>`,
    sms: goesLiveNow
      ? `No Agents: ${listing.address} is now live on Domain.com.au.`
      : `No Agents: Photos are in for ${listing.address}. It'll go live on ${effectivePublishAt.toLocaleDateString('en-AU')} as requested.`,
  });

  return res.status(200).json({ ok: true, listing, goesLiveNow, effectivePublishAt: effectivePublishAt.toISOString(), publishResult });
}
