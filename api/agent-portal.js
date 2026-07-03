import crypto from 'crypto';

const { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: KV_TOKEN } = process.env;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

function makeAgentToken(id, email) {
  return crypto.createHmac('sha256', 'no-agents-agent-v1').update(`${id}:${email}`).digest('hex');
}

// Tolerant parse: handles an already-deserialized value (object/array), a
// JSON-encoded string, or a legacy double-wrapped `{ value: "<json>" }` shape
// from a since-fixed write-path bug.
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

async function findAgentByToken(token) {
  const ids = safeParse(await kvGet('agents:all'));
  if (!Array.isArray(ids)) return null;
  for (const id of ids) {
    const ag = safeParse(await kvGet(`agent:${id}`));
    if (!ag) continue;
    if (makeAgentToken(ag.id, ag.email) === token && ag.status === 'approved') return ag;
  }
  return null;
}

async function getInspectionsForAgent(agent) {
  const ids = safeParse(await kvGet('inspections:all'));
  if (!Array.isArray(ids)) return [];
  const results = await Promise.all(ids.map(id => kvGet(`inspection:${id}`)));
  return results
    .map(r => { try { return safeParse(r); } catch { return null; } })
    .filter(Boolean)
    .filter(i => i.agentId === agent.id || i.agentName === agent.name);
}

async function getAvailableInspections() {
  const ids = safeParse(await kvGet('inspections:available'));
  if (!Array.isArray(ids)) return [];
  const results = await Promise.all(ids.map(id => kvGet(`inspection-req:${id}`)));
  return results
    .map(r => { try { return safeParse(r); } catch { return null; } })
    .filter(Boolean)
    .filter(i => i.status === 'open');
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) return res.status(503).json({ error: 'KV not configured' });

  // Login — POST with { email, phone }
  if (req.method === 'POST' && !req.query.action) {
    const { email, phone } = req.body || {};
    if (!email || !phone) return res.status(400).json({ error: 'Email and phone required' });

    const ids = safeParse(await kvGet('agents:all'));
    if (!Array.isArray(ids)) return res.status(401).json({ error: 'No agents found' });

    for (const id of ids) {
      const ag = safeParse(await kvGet(`agent:${id}`));
      if (!ag) continue;
      if (ag.email === email.trim().toLowerCase() && ag.phone === phone.trim()) {
        if (ag.status !== 'approved') {
          return res.status(403).json({ error: 'Your application is still ' + ag.status + '. We will be in touch.' });
        }
        const token = makeAgentToken(ag.id, ag.email);
        return res.status(200).json({ token, agent: { id: ag.id, name: ag.name, email: ag.email, suburb: ag.suburb } });
      }
    }
    return res.status(401).json({ error: 'No matching agent found. Check your email and phone number.' });
  }

  // All other routes require agent token
  const agentToken = req.headers['x-agent-token'] || req.query.token;
  const agent = await findAgentByToken(agentToken);
  if (!agent) return res.status(401).json({ error: 'Unauthorized' });

  // GET — dashboard data
  if (req.method === 'GET') {
    const [myInspections, available] = await Promise.all([
      getInspectionsForAgent(agent),
      getAvailableInspections(),
    ]);

    const totalEarned = myInspections.reduce((s, i) => s + (i.commissionOwed || 70), 0);
    const totalPaid = myInspections.filter(i => i.commissionPaid).reduce((s, i) => s + (i.commissionOwed || 70), 0);

    return res.status(200).json({
      agent: { id: agent.id, name: agent.name, email: agent.email, suburb: agent.suburb },
      myInspections,
      available,
      stats: { totalInspections: myInspections.length, totalEarned, totalPaid, outstanding: totalEarned - totalPaid },
    });
  }

  // POST ?action=claim — claim an available inspection
  if (req.method === 'POST' && req.query.action === 'claim') {
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'requestId required' });

    const raw = await kvGet(`inspection-req:${requestId}`);
    if (!raw) return res.status(404).json({ error: 'Inspection request not found' });
    const request = safeParse(raw);

    if (request.status !== 'open') {
      return res.status(409).json({ error: 'This inspection has already been claimed' });
    }

    request.status = 'claimed';
    request.claimedBy = agent.id;
    request.claimedByName = agent.name;
    request.claimedAt = new Date().toISOString();
    await kvSet(`inspection-req:${requestId}`, request);

    const inspId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const inspection = {
      id: inspId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      listingAddress: request.address,
      date: request.date,
      time: request.time || '',
      buyerName: request.buyerName || '',
      status: 'confirmed',
      commissionOwed: 70,
      commissionPaid: false,
      recordedAt: new Date().toISOString(),
    };
    await kvSet(`inspection:${inspId}`, inspection);

    const existingRaw = await kvGet('inspections:all');
    const parsedIds = safeParse(existingRaw);
    const ids = Array.isArray(parsedIds) ? parsedIds : [];
    ids.push(inspId);
    await kvSet('inspections:all', ids);

    return res.status(200).json({ ok: true, inspection });
  }

  return res.status(405).end();
}
