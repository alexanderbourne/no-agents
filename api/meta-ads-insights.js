// api/meta-ads-insights.js
// Proxy endpoint for Meta Graph API ad insights.
// Keeps the long access token server-side as an env var.
//
// GET /api/meta-ads-insights?adId=<id>&datePreset=yesterday
//
// Required env vars:
//   META_ACCESS_TOKEN  — long-lived Meta user access token
//   ADMIN_PASSWORD     — used as a simple bearer token for request auth
//
// Auth: pass ?secret=<ADMIN_PASSWORD> or header x-admin-token: <ADMIN_PASSWORD>

export default async function handler(req, res) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { ADMIN_PASSWORD, META_ACCESS_TOKEN } = process.env;
  const secret =
    req.headers['x-admin-token'] ||
    new URL(req.url, 'http://localhost').searchParams.get('secret');

  if (!ADMIN_PASSWORD || secret !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!META_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN env var not set' });
  }

  // ── Params ────────────────────────────────────────────────────────────────
  const params = new URL(req.url, 'http://localhost').searchParams;
  const adId = params.get('adId') || '52504036612945';
  const datePreset = params.get('datePreset') || 'yesterday';
  const fields = params.get('fields') || 'impressions,reach,clicks,ctr,cpc,cpm,spend,frequency';

  // ── Fetch from Meta ───────────────────────────────────────────────────────
  const metaUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(adId)}/insights?fields=${encodeURIComponent(fields)}&date_preset=${encodeURIComponent(datePreset)}&access_token=${META_ACCESS_TOKEN}`;

  try {
    const metaRes = await fetch(metaUrl);
    const data = await metaRes.json();

    res.setHeader('Cache-Control', 'no-store');
    return res.status(metaRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch from Meta Graph API', detail: err.message });
  }
}
