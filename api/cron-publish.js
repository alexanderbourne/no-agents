// api/cron-publish.js — Daily sweep to flip photo-ready listings live once
// their nominated/floor publish date arrives.
//
// api/mark-photos-ready.js already publishes immediately when photos are
// confirmed AFTER the effective date. This cron handles the other order:
// photos confirmed ready BEFORE the seller's requested future start date —
// those sit with status 'pending' + readyToPublish: true until their date
// arrives, which is what this job checks for.
//
// It also flags (admin email) listings whose effective publish date has
// already passed but photos still aren't confirmed ready — an operational
// nudge to chase Domain/the photographer.
//
// Triggered by Vercel Cron (see vercel.json). Vercel does not sign cron
// requests by default, so this checks a shared secret to stop it being
// triggered publicly.
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, CRON_SECRET

import { notifyAdmin } from './notify-admin.js';
import { notifySeller } from './notify-seller.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN, CRON_SECRET } = process.env;

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

function effectivePublishDate(listing) {
  const candidates = [listing.earliestPublishAt, listing.requestedStartDate].filter(Boolean).map(d => new Date(d));
  return candidates.length ? new Date(Math.max(...candidates.map(d => d.getTime()))) : null;
}

export default async function handler(req, res) {
  if (!CRON_SECRET || req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  const ids = safeParse(await kvGet('listings:active'));
  const listings = Array.isArray(ids)
    ? (await Promise.all(ids.map(id => kvGet(`listing:${id}`)))).map(safeParse).filter(Boolean)
    : [];

  const now = new Date();
  const published = [];
  const overdue = [];

  for (const listing of listings) {
    if (listing.status !== 'pending') continue;
    const effAt = effectivePublishDate(listing);
    if (!effAt || effAt > now) continue;

    if (listing.readyToPublish && listing.photoShoot?.status === 'completed' && Array.isArray(listing.images) && listing.images.length) {
      listing.status = 'current';
      listing.readyToPublish = false;
      listing.publishedAt = now.toISOString();
      await kvSet(`listing:${listing.id || listing.uniqueId}`, listing);
      published.push(listing.address);

      try {
        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://no-agents.com.au';
        await fetch(`${base}/api/publish-listing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing, portal: 'domain' }),
        });
      } catch (e) {
        console.error('[cron-publish] publish-listing call failed:', e.message);
      }

      await notifySeller({
        listing,
        subject: `Your listing is now live — ${listing.address}`,
        html: `<p>Hi ${listing.sellerName || 'there'},</p><p><strong>${listing.address}</strong> just went live on Domain.com.au as scheduled.</p>`,
        sms: `No Agents: ${listing.address} is now live on Domain.com.au.`,
      });
    } else {
      overdue.push(listing.address);
    }
  }

  if (published.length) {
    await notifyAdmin({
      subject: `${published.length} listing(s) published on schedule`,
      html: `<p>${published.map(a => `<strong>${a}</strong>`).join(', ')} went live on Domain.com.au today (scheduled date reached, photos already confirmed).</p>`,
    });
  }

  if (overdue.length) {
    await notifyAdmin({
      subject: `${overdue.length} listing(s) overdue — photos still not confirmed`,
      html: `<p>The nominated/floor publish date has passed for ${overdue.map(a => `<strong>${a}</strong>`).join(', ')} but photos aren't confirmed ready yet. Chase Domain/the photographer, then mark photos ready in the admin dashboard.</p>`,
      isError: true,
    });
  }

  return res.status(200).json({ ok: true, published, overdue });
}
