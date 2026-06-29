/**
 * /api/voice/index.js  →  handles /api/voice
 *
 * Entry point for all inbound calls to +61485043210.
 * NOTE: api/voice.js was removed — Vercel ignores foo.js when a foo/ directory
 * exists, so the handler must live here as index.js.
 */
import twilio from 'twilio';

const BASE = 'https://www.no-agents.com.au';

const GREETING = "Hello, you have reached No Agents. My name is Ari. Are you looking to sell a property?";

export default function handler(req, res) {
  const twiml = new twilio.twiml.VoiceResponse();

  // Seed history with Ari's greeting so respond.js knows the conversation started
  const seedHistory = JSON.stringify([{ role: 'assistant', content: GREETING }]);
  const encodedHistory = Buffer.from(seedHistory).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const gather = twiml.gather({
    input: 'speech',
    action: `${BASE}/api/voice/respond?history=${encodedHistory}`,
    method: 'POST',
    timeout: 10,
    speechTimeout: 'auto',
    language: 'en-AU',
  });

  gather.say({ voice: 'Polly.Olivia-Neural' }, GREETING);

  // Fallback if caller says nothing
  twiml.redirect({ method: 'POST' }, `${BASE}/api/voice`);

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).end(twiml.toString());
}
