// api/eoi.js
// Captures an expression of interest from sellers outside our QLD-only
// service area. Stores to KV for record-keeping and emails the office.
//
// POST { name, email, phone, address, state }
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN (storage),
//                     RESEND_API_KEY (email, optional)

const { KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY } = process.env;

async function kvSet(key, value) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return;
  await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

async function kvGet(key) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, phone, address, state } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const id = `eoi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const eoi = {
    id,
    name: name.trim(),
    email: email.trim(),
    phone: (phone || '').trim(),
    address: (address || '').trim(),
    state: (state || '').trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    await kvSet(`eoi:${id}`, eoi);
    const ids = Array.isArray(await kvGet('eoi:all')) ? await kvGet('eoi:all') : [];
    ids.push(id);
    await kvSet('eoi:all', ids);
  } catch (e) {
    console.error('eoi kv store error:', e.message);
  }

  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'No Agents <office@no-agents.com.au>',
          to: ['office@no-agents.com.au'],
          subject: `Out-of-area EOI — ${eoi.state || 'unknown state'}`,
          html: `<div style="font-family:sans-serif;max-width:500px;">
            <h2>New expression of interest (outside QLD)</h2>
            <table style="border-collapse:collapse;width:100%;">
              <tr><td style="padding:8px;color:#666">Name</td><td style="padding:8px;font-weight:600">${eoi.name}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Email</td><td style="padding:8px">${eoi.email}</td></tr>
              <tr><td style="padding:8px;color:#666">Phone</td><td style="padding:8px">${eoi.phone || 'N/A'}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Address</td><td style="padding:8px">${eoi.address || 'N/A'}</td></tr>
              <tr><td style="padding:8px;color:#666">State</td><td style="padding:8px">${eoi.state || 'N/A'}</td></tr>
            </table>
          </div>`,
        }),
      });
    } catch (e) {
      console.error('eoi email error:', e.message);
    }
  }

  return res.status(200).json({ ok: true });
}
