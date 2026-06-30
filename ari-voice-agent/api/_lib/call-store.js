const { Redis } = require('@upstash/redis');

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const CALL_TTL = 60 * 60 * 24;

function callKey(callSid) {
  return `call:${callSid}`;
}

async function getCall(callSid) {
  const data = await getRedis().get(callKey(callSid));
  if (!data) {
    return { messages: [], callerNumber: 'Unknown', startTime: new Date().toISOString() };
  }
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function saveCall(callSid, callData) {
  await getRedis().set(callKey(callSid), JSON.stringify(callData), { ex: CALL_TTL });
}

async function appendTurn(callSid, callerNumber, userMessage, assistantMessage) {
  const call = await getCall(callSid);
  call.callerNumber = callerNumber;
  call.messages.push({ role: 'user', content: userMessage });
  call.messages.push({ role: 'assistant', content: assistantMessage });
  call.lastTurn = new Date().toISOString();
  await saveCall(callSid, call);
  return call;
}

module.exports = { getCall, saveCall, appendTurn };
