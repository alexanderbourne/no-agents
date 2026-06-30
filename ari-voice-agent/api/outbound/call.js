const twilio = require('twilio');

/**
 * Initiates an outbound call from No-Agents (+61485043210)
 * Called by Claude/AI when action is needed (e.g., calling a tradesperson, following up a lead)
 *
 * POST /api/outbound/call
 * Headers: x-api-key: <OUTBOUND_API_KEY>
 * Body: {
 *   to: "+61XXXXXXXXX",       -- who to call
 *   message: "Hi, this is...", -- opening message Ari will say
 *   context: "Calling plumber re: 12 Smith St leak" -- for logging
 * }
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Auth check
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.OUTBOUND_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, message, context } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Required: to (phone number), message (opening line)' });
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // Escape the message for TwiML XML
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // TwiML: Ari opens with the message, then enters conversation loop
  const twimlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/api/voice/respond" method="POST" speechTimeout="auto" language="en-AU" enhanced="true">
    <Say voice="Polly.Olivia">${safeMessage}</Say>
  </Gather>
  <Hangup/>
</Response>`;

  try {
    const call = await client.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER || '+61485043210',
      twiml: twimlBody,
      statusCallback: `${process.env.BASE_URL}/api/voice/end`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
    });

    console.log('OUTBOUND_CALL_INITIATED:', JSON.stringify({
      callSid: call.sid,
      to,
      context: context || 'No context provided',
      timestamp: new Date().toISOString()
    }));

    return res.json({
      success: true,
      callSid: call.sid,
      to,
      status: call.status,
      context
    });

  } catch (error) {
    console.error('Outbound call error:', error);
    return res.status(500).json({ error: error.message });
  }
};
