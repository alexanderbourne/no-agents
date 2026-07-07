// api/seo-report.js
// Real, structured Search Console + GA4 data via the official Google APIs —
// the "build it out properly" alternative to browser-scraping or Supermetrics.
// Uses a dedicated service account (seo-reporting@..., read-only access
// granted directly in both GSC and GA4 — see project docs) rather than a
// personal Google login, so this works independently of anyone's own session.
//
// GET /api/seo-report — admin-token protected, returns combined JSON:
//   { searchConsole: { totals, topQueries, sitemaps }, ga4: { totals } }
//
// Required env vars:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY (PEM, multi-line)
//   GSC_SITE_URL   — e.g. https://www.no-agents.com.au/ (must match the exact verified property)
//   GA4_PROPERTY_ID — numeric GA4 property id (no "properties/" prefix)
//   ADMIN_PASSWORD  — verified via admin-auth.js

import { GoogleAuth } from 'google-auth-library';
import { verifyAdminToken } from './admin-auth.js';

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_KEY,
  GSC_SITE_URL,
  GA4_PROPERTY_ID,
} = process.env;

let cachedAuth = null;
function getAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = new GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Env vars sometimes arrive with literal "\n" instead of real newlines
      // depending on how they were set — normalise either way.
      private_key: (GOOGLE_SERVICE_ACCOUNT_KEY || '').includes('\\n')
        ? GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n')
        : GOOGLE_SERVICE_ACCOUNT_KEY,
    },
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  });
  return cachedAuth;
}

async function authedFetch(url, options = {}) {
  const client = await getAuth().getClient();
  const token = await client.getAccessToken();
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error?.message || `${url} → ${r.status}`);
  return body;
}

async function getSearchConsoleData() {
  const siteUrl = GSC_SITE_URL;
  const encodedSite = encodeURIComponent(siteUrl);
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [totalsRes, topQueriesRes, sitemapsRes] = await Promise.all([
    authedFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, dimensions: [] }),
    }),
    authedFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 20 }),
    }),
    authedFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`),
  ]);

  const totalsRow = (totalsRes.rows || [])[0] || {};
  return {
    dateRange: { startDate, endDate },
    totals: {
      clicks: totalsRow.clicks || 0,
      impressions: totalsRow.impressions || 0,
      ctr: totalsRow.ctr || 0,
      position: totalsRow.position || null,
    },
    topQueries: (topQueriesRes.rows || []).map(r => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    sitemaps: (sitemapsRes.sitemap || []).map(s => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      lastDownloaded: s.lastDownloaded,
      isPending: s.isPending,
      errors: s.errors || 0,
      warnings: s.warnings || 0,
    })),
  };
}

async function getGa4Data() {
  const endDate = 'today';
  const startDate = '28daysAgo';

  const report = await authedFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'conversions' },
        ],
      }),
    }
  );

  const row = (report.rows || [])[0];
  const val = i => (row ? Number(row.metricValues[i]?.value || 0) : 0);
  return {
    dateRange: { startDate: '28 days ago', endDate: 'today' },
    totals: {
      sessions: val(0),
      activeUsers: val(1),
      pageViews: val(2),
      conversions: val(3),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const token = (req.headers['x-admin-token'] || '').trim();
  if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({ error: 'Google service account not configured' });
  }

  const [searchConsole, ga4] = await Promise.allSettled([
    getSearchConsoleData(),
    getGa4Data(),
  ]);

  return res.status(200).json({
    searchConsole: searchConsole.status === 'fulfilled' ? searchConsole.value : { error: searchConsole.reason?.message },
    ga4: ga4.status === 'fulfilled' ? ga4.value : { error: ga4.reason?.message },
  });
}
