import twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

async function kvGet(key) {
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

async function kvSet(key, value) {
  await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}

export default async function handler(req, res) {
  const historyParam = req.query.history || req.body.history || '';
  const callerNumber = req.query.caller || req.body.From || 'Unknown';
  const callSid = req.body.CallSid || req.query.callSid || '';
  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
  const isoTimestamp = new Date().toISOString();

  let messages = [];
  let parsed = { callerType: 'unknown', callerName: 'Unknown', callbackNumber: '', property: '', enquiry: '', urgency: 'Low' };
  let summary = 'No conversation captured.';
  let actionItems = [];

  // Prefer KV (has full untruncated history), fall back to URL param
  if (callSid && KV_REST_API_URL) {
    try {
      const raw = await kvGet(`call:${callSid}`);
      if (raw) {
        const callData = typeof raw === 'string' ? JSON.parse(raw) : raw;
        messages = callData.messages || [];
      }
    } catch (e) {
      console.error('KV history read error:', e);
    }
  }
  if (messages.length === 0 && historyParam) {
    try {
      const base64 = historyParam.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      messages = JSON.parse(decoded);
    } catch (e) {
      console.error('History decode error:', e);
    }
  }

  if (messages.length > 0) {
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: `You extract structured data from phone call transcripts for a real estate agency (No-Agents).
Return ONLY valid JSON, no markdown, no explanation. Use this exact schema:
{
  "callerType": "seller" | "buyer" | "tenant" | "tradesperson" | "other",
  "callerName": "string or Unknown",
  "callbackNumber": "string or empty",
  "property": "full address or empty",
  "enquiry": "one sentence summary",
  "actionItems": ["array of follow-up tasks"],
  "urgency": "High" | "Medium" | "Low"
}`,
        messages: [
          { role: 'user', content: `Call transcript:\n${messages.map(m => `${m.role === 'assistant' ? 'Ari' : 'Caller'}: ${m.content}`).join('\n')}\n\nExtract the structured data as JSON.` }
        ]
      });

      const raw = summaryResponse.content[0].text.trim();
      try {
        parsed = JSON.parse(raw);
        actionItems = parsed.actionItems || [];
        summary = `${parsed.callerType.toUpperCase()} | ${parsed.callerName} | ${parsed.property || 'No address'} | ${parsed.enquiry}`;
      } catch {
        summary = raw;
      }
    } catch (e) {
      console.error('Summary generation error:', e);
      summary = 'Error generating summary.';
    }
  }

  const lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    callSid,
    callerNumber,
    callerName: parsed.callerName || 'Unknown',
    callerType: parsed.callerType || 'unknown',
    callbackNumber: parsed.callbackNumber || callerNumber,
    property: parsed.property || '',
    enquiry: parsed.enquiry || '',
    urgency: parsed.urgency || 'Low',
    actionItems,
    status: 'new',
    timestamp: isoTimestamp,
    timestampLocal: timestamp,
    conversation: messages,
  };

  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    try {
      await kvSet(`lead:${lead.id}`, JSON.stringify(lead));
      const idsRaw = await kvGet('leads:index');
      let ids = [];
      if (Array.isArray(idsRaw)) {
        ids = idsRaw;
      } else if (typeof idsRaw === 'string' && idsRaw) {
        try {
          const parsed = JSON.parse(idsRaw);
          if (Array.isArray(parsed)) ids = parsed;
        } catch { /* leave ids as [] */ }
      }
      ids.unshift(lead.id);
      await kvSet('leads:index', JSON.stringify(ids));
    } catch (e) {
      console.error('KV lead storage error:', e);
    }
  }

  console.log('CALL_COMPLETED:', JSON.stringify(lead));

  // Send email notification via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const urgencyEmoji = lead.urgency === 'High' ? '🔴' : lead.urgency === 'Medium' ? '🟡' : '🟢';
      const hasActions = actionItems.length > 0;
      const nameLabel = lead.callerName !== 'Unknown' ? lead.callerName : callerNumber;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ari at No-Agents <ari@no-agents.com.au>',
          to: [process.env.NOTIFICATION_EMAIL || 'alex.s.bourne@gmail.com'],
          subject: `${urgencyEmoji} New lead: ${nameLabel}${lead.property ? ' — ' + lead.property : ''}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2 style="color: #1a1a2e;">New Lead from Ari</h2>
              <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 6px 8px; color: #666; width: 120px;">Name</td><td style="padding: 6px 8px;"><strong>${lead.callerName}</strong></td></tr>
                <tr><td style="padding: 6px 8px; color: #666;">Phone</td><td style="padding: 6px 8px;">${lead.callbackNumber || callerNumber}</td></tr>
                <tr><td style="padding: 6px 8px; color: #666;">Property</td><td style="padding: 6px 8px;">${lead.property || 'Not provided'}</td></tr>
                <tr><td style="padding: 6px 8px; color: #666;">Type</td><td style="padding: 6px 8px;">${lead.callerType}</td></tr>
                <tr><td style="padding: 6px 8px; color: #666;">Urgency</td><td style="padding: 6px 8px;">${urgencyEmoji} ${lead.urgency}</td></tr>
                <tr><td style="padding: 6px 8px; color: #666;">Time</td><td style="padding: 6px 8px;">${timestamp} AEST</td></tr>
              </table>

              <h3 style="color: #1a1a2e; margin-top: 20px;">Enquiry</h3>
              <p style="background: #f5f5f5; padding: 12px; border-radius: 8px;">${lead.enquiry || 'No summary available.'}</p>

              ${hasActions ? `
              <h3 style="color: #e74c3c; margin-top: 16px;">Action Items</h3>
              <ul style="color: #e74c3c;">${actionItems.map(a => `<li>${a}</li>`).join('')}</ul>
              ` : ''}

              <h3 style="color: #1a1a2e; margin-top: 20px;">Conversation</h3>
              <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; font-size: 14px;">
                ${messages.map(m => `<div style="margin-bottom: 8px;"><strong style="color: ${m.role === 'assistant' ? '#2ecc71' : '#3498db'};">${m.role === 'assistant' ? 'Ari' : 'Caller'}:</strong> ${m.content}</div>`).join('')}
              </div>

              <p style="margin-top: 20px; font-size: 13px; color: #999;"><a href="https://www.no-agents.com.au/leads" style="color: #1a1a2e;">View all leads →</a></p>
            </div>
          `
        })
      });
    } catch (e) {
      console.error('Email notification error:', e);
    }
  }

  // End the call
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.hangup();

  res.setHeader('Content-Type', 'text/xml');
  res.end(twiml.toString());
}
