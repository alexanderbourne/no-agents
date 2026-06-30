const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { getCall, appendTurn } = require('../_lib/call-store');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Ari, the AI voice assistant for No-Agents — a modern Australian property management company.

No-Agents provides professional property management without the traditional high agent fees. We use technology to deliver better outcomes for landlords and tenants.

YOUR PERSONALITY:
- Warm, professional, and efficient
- Speak naturally in Australian English
- Sound like a real person, not a robot

YOUR GOALS ON EACH CALL:
1. Quickly understand who is calling:
   - Property owner/landlord looking for management
   - Existing client (owner or tenant) with a query
   - Tradesperson enquiring about work
   - General enquiry

2. For property owners: capture property address, whether self-managing or with another agency, what they're looking for
3. For tenants: capture their property address, nature of issue (maintenance, rent, lease)
4. For tradespeople: capture name, trade type, and availability
5. Always try to get: caller's name and best callback number

ACTION ITEMS TO FLAG:
- If someone wants a callback → confirm their number and note "ACTION: callback needed"
- If urgent maintenance → note "ACTION: urgent maintenance at [address]"
- If hot lead (owner wanting management) → note "ACTION: hot lead - [details]"

CRITICAL VOICE RULES:
- Keep EVERY response under 35 words. This is a phone call — be concise.
- Never use bullet points, lists, or formatting — speak naturally
- If ending the call, include the word "goodbye" naturally

NEVER:
- Make up services or prices you don't know
- Make promises about fees without saying "I'll have someone confirm that with you"`;

module.exports = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const speechResult = req.body.SpeechResult || '';
    const callSid = req.body.CallSid || '';
    const callerNumber = req.body.From || 'Unknown';

    const call = await getCall(callSid);
    const callerInput = speechResult || '[silent]';

    const messagesForClaude = [
      ...call.messages.slice(-10),
      { role: 'user', content: callerInput }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 120,
      system: SYSTEM_PROMPT,
      messages: messagesForClaude,
    });

    const ariResponse = response.content[0].text.trim();

    console.log('CALL_TURN:', JSON.stringify({
      callSid,
      caller: callerNumber,
      turn: call.messages.length + 2,
      callerSaid: callerInput,
      ariSaid: ariResponse,
      time: new Date().toISOString()
    }));

    await appendTurn(callSid, callerNumber, callerInput, ariResponse);

    const endPhrases = ['goodbye', 'bye', 'take care', 'have a great', 'have a good', 'all the best', 'thanks for calling'];
    const isEnding = endPhrases.some(p => ariResponse.toLowerCase().includes(p));

    if (isEnding) {
      twiml.say({ voice: 'Polly.Olivia' }, ariResponse);
      twiml.redirect(
        { method: 'POST' },
        `/api/voice/end?caller=${encodeURIComponent(callerNumber)}`
      );
    } else {
      const gather = twiml.gather({
        input: 'speech',
        action: '/api/voice/respond',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-AU',
        enhanced: 'true',
      });

      gather.say({ voice: 'Polly.Olivia' }, ariResponse);

      twiml.say({ voice: 'Polly.Olivia' }, "Sorry, I didn't catch that. Is there anything else I can help with?");
      twiml.redirect({ method: 'POST' }, '/api/voice/respond');
    }

  } catch (error) {
    console.error('Ari voice agent error:', error);
    twiml.say(
      { voice: 'Polly.Olivia' },
      "I'm sorry, I'm having a technical issue right now. Please call back shortly or visit no-agents.com.au."
    );
    twiml.hangup();
  }

  res.setHeader('Content-Type', 'text/xml');
  res.end(twiml.toString());
};
