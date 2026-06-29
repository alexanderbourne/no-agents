import twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';

const BASE = 'https://www.no-agents.com.au';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;

async function kvSet(key, value) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return;
  await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  }).catch(() => {});
}

async function kvGet(key) {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  const r = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const { result } = await r.json();
  return result ?? null;
}

const SYSTEM_PROMPT = `You are Ari, a friendly AI assistant answering the phone for No Agents — a licensed Queensland real estate agency (Licence 4542501).

No Agents charges a flat $798 for a Complete Listing Package. This includes Domain.com.au listing, professional photography, 3D virtual tour and Facebook advertising. Zero commission, ever. We handle enquiries, inspections, and the offer process.

YOUR JOB: Qualify seller leads.

CALL FLOW:
1. Find out if they want to sell
2. Get the property address
3. Get their name and best callback number
4. Let them know someone will call back to get started

VOICE RULES — your text is read aloud by a text-to-speech engine, so:
- Keep responses under 25 words. Short sentences only.
- Use plain, clear English. Sound warm and professional.
- NEVER use slang, filler words, or abbreviations the TTS will mangle (no "cheers", "arvo", "gonna", "reckon", "no worries", "mate", "all good").
- Prefer full words: "thank you" not "thanks", "yes" not "yeah", "okay" not "OK".
- Use commas for natural pauses: "Great, and what is the address?"
- End calls with "Thank you for calling. Goodbye." — nothing fancy.
- One question at a time. Never stack two questions.

If they ask about buying: "We are a sellers only agency, but happy to help if you are looking to sell."
If they ask about commission or fees: "It is a flat seven hundred and ninety eight dollars for everything, with no commission at all."
If anything complex comes up: "I will have someone call you back to go through that with you."

Never invent prices, services, or timelines beyond what is listed above.`;

export default async function handler(req, res) {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const speechResult = req.body.SpeechResult || '';
    const callerNumber = req.body.From || 'Unknown';
    const historyParam = req.query.history || '';

    // Parse conversation history from URL param
    let messages = [];
    if (historyParam) {
      try {
        // Reverse URL-safe base64
        const base64 = historyParam.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        messages = JSON.parse(decoded);
      } catch (e) {
        messages = [];
      }
    }

    // Add caller's speech
    const callerInput = speechResult || '[silent]';
    messages.push({ role: 'user', content: callerInput });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10),
    });

    const ariResponse = response.content[0].text.trim()
      .replace(/\bOK\b/g, 'okay')
      .replace(/\$798/g, 'seven hundred and ninety eight dollars');

    console.log('TURN:', JSON.stringify({ caller: callerNumber, said: callerInput, ari: ariResponse }));

    messages.push({ role: 'assistant', content: ariResponse });

    // Persist full conversation to KV keyed by CallSid (survives URL truncation)
    const callSid = req.body.CallSid || '';
    if (callSid) {
      try {
        const existing = await kvGet(`call:${callSid}`);
        const callData = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : {};
        if (!Array.isArray(callData.messages)) callData.messages = [];
        callData.callerNumber = callerNumber;
        callData.messages.push({ role: 'user', content: callerInput });
        callData.messages.push({ role: 'assistant', content: ariResponse });
        callData.lastTurn = new Date().toISOString();
        await kvSet(`call:${callSid}`, JSON.stringify(callData));
      } catch (e) {
        console.error('KV call log error:', e);
      }
    }

    // Encode history for next turn (keep last 8 messages, URL-safe base64)
    const recentMessages = messages.slice(-8);
    const encodedHistory = Buffer.from(JSON.stringify(recentMessages)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Detect call end
    const endPhrases = ['goodbye', 'take care', 'have a great day', 'have a good one', 'all the best', 'cheers for now'];
    const lower = ariResponse.toLowerCase();
    const isEnding = endPhrases.some(p => lower.includes(p));

    const VOICE = 'Polly.Olivia-Neural';

    if (isEnding) {
      twiml.say({ voice: VOICE }, ariResponse);
      twiml.redirect(
        { method: 'POST' },
        `${BASE}/api/voice/end?history=${encodedHistory}&caller=${encodeURIComponent(callerNumber)}`
      );
    } else {
      const gather = twiml.gather({
        input: 'speech',
        action: `${BASE}/api/voice/respond?history=${encodedHistory}`,
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto',
        language: 'en-AU',
      });

      gather.say({ voice: VOICE }, ariResponse);

      // Fallback if no response after gather
      twiml.say({ voice: VOICE }, "Are you still there?");
      twiml.redirect({ method: 'POST' }, `${BASE}/api/voice/respond?history=${encodedHistory}`);
    }

  } catch (error) {
    console.error('Ari voice agent error:', error);
    twiml.say(
      { voice: 'Polly.Olivia-Neural' },
      "I'm having a technical issue — please call back shortly or visit no-agents.com.au."
    );
    twiml.hangup();
  }

  res.setHeader('Content-Type', 'text/xml');
  res.end(twiml.toString());
}
