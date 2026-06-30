const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { getCall, saveCall } = require('../_lib/call-store');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async (req, res) => {
  const callerNumber = req.query.caller || req.body.From || 'Unknown';
  const callSid = req.body.CallSid || req.query.callSid || '';
  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });

  const call = await getCall(callSid);
  const messages = call.messages || [];

  let summary = '';
  let actionItems = [];

  if (messages.length > 0) {
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: `You summarise phone calls for a property management company (No-Agents).
You MUST extract information from the conversation provided. Do NOT ask for more information.
Format your response EXACTLY as:
CALLER TYPE: [owner/tenant/tradesperson/other]
CALLER NAME: [name or Unknown]
CALLBACK NUMBER: [number or Not provided]
PROPERTY: [address or Not mentioned]
ENQUIRY: [one sentence summary]
ACTION ITEMS: [bullet list of things that need follow-up, or None]
URGENCY: [High/Medium/Low]`,
        messages: [
          ...messages,
          { role: 'user', content: 'Summarise the above call conversation now.' }
        ]
      });

      summary = summaryResponse.content[0].text.trim();

      const actionMatch = summary.match(/ACTION ITEMS:([\s\S]*?)(?:URGENCY:|$)/i);
      if (actionMatch) {
        actionItems = actionMatch[1].trim().split('\n').filter(a => a.trim() && a.trim() !== 'None');
      }
    } catch (e) {
      console.error('Summary generation error:', e);
      summary = 'Error generating summary.';
    }
  } else {
    summary = `No conversation history was captured for this call.\nCaller: ${callerNumber}\nTime: ${timestamp}\nCall SID: ${callSid}\n\nACTION ITEMS:\n- Callback may be needed — conversation was not recorded\nURGENCY: Medium`;
    actionItems = ['Callback may be needed — conversation was not recorded'];
  }

  // Save summary back to Redis for the call record
  call.summary = summary;
  call.actionItems = actionItems;
  call.endTime = timestamp;
  await saveCall(callSid, call);

  console.log('CALL_COMPLETED:', JSON.stringify({
    callSid,
    callerNumber,
    timestamp,
    summary,
    actionItems,
    turns: messages.length,
  }));

  if (process.env.RESEND_API_KEY) {
    try {
      const urgencyEmoji = summary.includes('High') ? '🔴' : summary.includes('Medium') ? '🟡' : '🟢';
      const hasActions = actionItems.length > 0 && actionItems[0] !== 'None';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ari at No-Agents <ari@no-agents.com.au>',
          to: [process.env.NOTIFICATION_EMAIL || 'alex.s.bourne@gmail.com'],
          subject: `${urgencyEmoji} Call from ${callerNumber} — ${timestamp}${hasActions ? ' ⚡ ACTION REQUIRED' : ''}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px;">
              <h2 style="color: #1a1a2e;">📞 Inbound Call Summary</h2>
              <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 4px 8px; color: #666;">Caller</td><td style="padding: 4px 8px;"><strong>${callerNumber}</strong></td></tr>
                <tr><td style="padding: 4px 8px; color: #666;">Time</td><td style="padding: 4px 8px;">${timestamp} AEST</td></tr>
                <tr><td style="padding: 4px 8px; color: #666;">Call SID</td><td style="padding: 4px 8px; font-size: 12px; color: #999;">${callSid}</td></tr>
              </table>

              <h3 style="color: #1a1a2e; margin-top: 24px;">Summary</h3>
              <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 14px;">${summary}</pre>

              ${hasActions ? `
              <h3 style="color: #e74c3c;">⚡ Action Items</h3>
              <ul style="color: #e74c3c;">
                ${actionItems.map(a => `<li>${a.replace(/^[-•*]\s*/, '')}</li>`).join('')}
              </ul>
              ` : ''}

              <h3 style="color: #1a1a2e; margin-top: 24px;">Full Conversation</h3>
              <div style="background: #f9f9f9; padding: 16px; border-radius: 8px;">
                ${messages.map(m => `
                  <div style="margin-bottom: 12px;">
                    <strong style="color: ${m.role === 'assistant' ? '#2ecc71' : '#3498db'};">
                      ${m.role === 'assistant' ? 'Ari' : 'Caller'}:
                    </strong>
                    <span style="margin-left: 8px;">${m.content}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `
        })
      });
    } catch (e) {
      console.error('Email notification error:', e);
    }
  }

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.hangup();

  res.setHeader('Content-Type', 'text/xml');
  res.end(twiml.toString());
};
