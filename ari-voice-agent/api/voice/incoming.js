const twilio = require('twilio');
const { saveCall } = require('../_lib/call-store');

module.exports = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid || '';
  const callerNumber = req.body.From || 'Unknown';

  try {
    if (callSid) {
      await saveCall(callSid, {
        messages: [],
        callerNumber,
        startTime: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Redis init error:', e);
  }

  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/respond',
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-AU',
    enhanced: 'true',
  });

  gather.say(
    { voice: 'Polly.Olivia' },
    "Hi, you've reached No-Agents. I'm Ari, your AI property assistant. How can I help you today?"
  );

  twiml.redirect({ method: 'POST' }, '/api/voice/incoming');

  res.setHeader('Content-Type', 'text/xml');
  res.end(twiml.toString());
};
