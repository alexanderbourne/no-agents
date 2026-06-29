/**
 * /api/voice-relay.js
 *
 * Twilio ConversationRelay WebSocket handler.
 *
 * Twilio opens a WebSocket to this endpoint for the duration of each call.
 * It sends JSON events (setup, prompt, interrupt, dtmf, end) and expects
 * JSON responses (text tokens to speak, or an "end" command to hang up).
 *
 * Hosting note:
 *   ConversationRelay requires a persistent WebSocket connection. On Vercel
 *   this is handled via the Node.js HTTP server's "upgrade" event, which
 *   persists within a warm function instance. vercel.json sets maxDuration
 *   to 300s (Vercel Pro) for this function to allow longer calls.
 *   If you need calls beyond 5 min, consider Vercel Enterprise (900s) or
 *   a long-running host such as Railway/Fly.io.
 *
 * ConversationRelay event types received:
 *   { type: "setup",     callSid, from, to, ... }
 *   { type: "prompt",    voicePrompt, callSid, last }
 *   { type: "interrupt", utteranceUntilInterrupt, ... }
 *   { type: "dtmf",      digit }
 *   { type: "end",       reasonCode }  (call hung up)
 *
 * Response messages sent back over WebSocket:
 *   { type: "text",  token: "...", last: true }   — speak text
 *   { type: "end" }                                — hang up the call
 */

import { WebSocketServer } from 'ws';
import Anthropic from '@anthropic-ai/sdk';

// ─── Anthropic client (reused across warm invocations) ───────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── AI persona & knowledge ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant for No Agents, Brisbane's flat-fee real estate agency.

ABOUT NO AGENTS:
- Flat-fee real estate agency based in Brisbane, Australia
- Complete Listing Package: $798 flat fee — includes Domain.com.au listing, professional photography, 3D virtual tour and Facebook advertising. Everything included, no commission.
- No commission — sellers keep more of their sale price
- Full support throughout the sales process
- Website: no-agents.com.au

YOUR JOB:
1. Answer common questions about pricing, how the service works, and what's included
2. Capture seller leads — get the caller's name, property address, and best callback number
3. Book callbacks for complex questions you can't answer ("I'll have someone from the team call you back")
4. Be warm, professional, and efficient — this is a phone call, not a chat

CALL HANDLING GUIDE:
- Pricing questions: quote the packages above confidently
- "How does it work?": We list your property on Domain.com.au and all major portals for a flat fee. No commission on sale.
- "Do you negotiate for me?": Yes, our team supports you through negotiations and settlement.
- "Is there a contract?": Yes, we use a standard Queensland sales authority — no lock-in periods.
- Unsure about something: "Great question — let me get someone from the team to call you back and give you all the details."
- To book a callback: get their name, number, and best time to call.

VOICE RULES (critical — this is a phone call):
- Keep every response under 40 words. Short, clear sentences only.
- No bullet points, lists, or markdown — speak naturally.
- Use Australian English (e.g. "cheers", "no worries", "arvo").
- If the caller says goodbye or thanks and ends the conversation, say a warm farewell and include the word "goodbye".

NEVER:
- Invent fees or services not listed above
- Make legal or financial guarantees
- Commit to specific timelines without team confirmation`;

// ─── Vercel WebSocket setup (persists within a warm function instance) ────────
let wssReady = false;

function setupWebSocketServer(server) {
  if (wssReady) return;
  wssReady = true;

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Only handle requests to this endpoint
    if (!request.url?.startsWith('/api/voice-relay')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', handleConversationRelay);
  console.log('[voice-relay] WebSocket server ready');
}

// ─── Main Vercel handler (HTTP entry point) ───────────────────────────────────
export default function handler(req, res) {
  // Attach the WebSocket server to the underlying Node HTTP server once.
  if (res.socket?.server) {
    setupWebSocketServer(res.socket.server);
  }

  // Respond to plain HTTP health checks / Twilio status callbacks
  res.status(200).json({ status: 'ok', service: 'no-agents-voice-relay' });
}

// ─── ConversationRelay session handler ───────────────────────────────────────
function handleConversationRelay(ws) {
  // Per-call conversation history (in memory for this WebSocket session)
  const messages = [];
  let callSid = null;
  let callerNumber = null;

  ws.on('message', async (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      console.error('[voice-relay] Failed to parse event:', raw.toString());
      return;
    }

    switch (event.type) {
      case 'setup':
        callSid = event.callSid;
        callerNumber = event.from || 'unknown';
        console.log(`[voice-relay] Call started — SID: ${callSid}, from: ${callerNumber}`);
        // No response needed — welcomeGreeting in TwiML handles the opening line
        break;

      case 'prompt':
        await handlePrompt(ws, messages, event.voicePrompt, callSid);
        break;

      case 'interrupt':
        // User interrupted — Twilio stops playing audio automatically.
        // Log it for debugging; no action needed here.
        console.log(`[voice-relay] Interrupted after: "${event.utteranceUntilInterrupt}"`);
        break;

      case 'dtmf':
        // Keypad press — ignore for now
        console.log(`[voice-relay] DTMF: ${event.digit}`);
        break;

      case 'end':
        console.log(`[voice-relay] Call ended — SID: ${callSid}, reason: ${event.reasonCode}`);
        logCallSummary(callSid, callerNumber, messages);
        break;

      default:
        console.log(`[voice-relay] Unknown event type: ${event.type}`);
    }
  });

  ws.on('close', () => {
    console.log(`[voice-relay] WebSocket closed — SID: ${callSid}`);
  });

  ws.on('error', (err) => {
    console.error(`[voice-relay] WebSocket error — SID: ${callSid}:`, err.message);
  });
}

// ─── Handle a caller utterance ────────────────────────────────────────────────
async function handlePrompt(ws, messages, userInput, callSid) {
  if (!userInput?.trim()) {
    send(ws, { type: 'text', token: "Sorry, I didn't catch that — could you repeat?", last: true });
    return;
  }

  messages.push({ role: 'user', content: userInput });
  console.log(`[voice-relay] [${callSid}] Caller: "${userInput}"`);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-12), // keep last 12 turns (6 exchanges)
    });

    const aiText = response.content[0].text.trim();
    messages.push({ role: 'assistant', content: aiText });
    console.log(`[voice-relay] [${callSid}] Assistant: "${aiText}"`);

    send(ws, { type: 'text', token: aiText, last: true });

    // If the AI said goodbye, end the call after a short delay
    const endPhrases = ['goodbye', 'bye', 'take care', 'have a great', 'all the best', 'thanks for calling'];
    if (endPhrases.some((p) => aiText.toLowerCase().includes(p))) {
      setTimeout(() => {
        if (ws.readyState === ws.OPEN) {
          send(ws, { type: 'end' });
        }
      }, 3500); // allow TTS to finish speaking
    }
  } catch (err) {
    console.error(`[voice-relay] Claude error — SID: ${callSid}:`, err.message);
    send(ws, {
      type: 'text',
      token: "I'm having a technical issue right now. Please try again shortly or visit no-agents.com.au.",
      last: true,
    });
  }
}

// ─── Utility: safe WebSocket send ────────────────────────────────────────────
function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// ─── Utility: log call summary to console (extend to email/DB as needed) ─────
function logCallSummary(callSid, callerNumber, messages) {
  console.log('[voice-relay] CALL_SUMMARY:', JSON.stringify({
    callSid,
    callerNumber,
    timestamp: new Date().toISOString(),
    turns: messages.length,
    conversation: messages,
  }));
}
