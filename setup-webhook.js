#!/usr/bin/env node
/**
 * No Agents — One-time setup script
 * 1. Sets Twilio webhook for +61485043210 → https://no-agents.com.au/api/voice (POST)
 * 2. Checks Vercel env vars (ANTHROPIC_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
 *
 * Run: node setup-webhook.js
 * Requires: npm install twilio @vercel/sdk  (or just uses fetch, available in Node 18+)
 */

const TWILIO_ACCOUNT_SID = 'ACc4c971f5eeca4625a1c41e221f4b64a4';
const TWILIO_AUTH_TOKEN  = '003b4601cbee402fad7ab3e4ff4f789a';
const PHONE_NUMBER       = '+61485043210';
const VOICE_URL          = 'https://www.no-agents.com.au/api/voice';
const VERCEL_PROJECT_ID  = 'prj_HBZwB41JyWdJC8T7c94Gkvobk2yG';
const VERCEL_TEAM_ID     = 'team_lA6dpia2wK9bZmXKgJ2bCHA2';

// ─── Twilio: find phone number SID then update webhook ────────────────────────
async function setTwilioWebhook() {
  console.log('\n📞 TWILIO: Finding phone number SID...');
  const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
  const auth  = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  // 1. List phone numbers filtered by number
  const listRes = await fetch(
    `${base}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(PHONE_NUMBER)}`,
    { headers: { Authorization: auth } }
  );
  const list = await listRes.json();

  if (!list.incoming_phone_numbers?.length) {
    console.error('❌ Phone number not found:', PHONE_NUMBER);
    process.exit(1);
  }

  const { sid, phone_number, voice_url } = list.incoming_phone_numbers[0];
  console.log(`   Found: ${phone_number} (SID: ${sid})`);
  console.log(`   Current voice_url: ${voice_url || '(none)'}`);

  if (voice_url === VOICE_URL) {
    console.log('✅ Webhook already set correctly — nothing to do.');
    return;
  }

  // 2. Update webhook
  console.log(`   Setting voice_url → ${VOICE_URL}`);
  const body = new URLSearchParams({ VoiceUrl: VOICE_URL, VoiceMethod: 'POST' });
  const updateRes = await fetch(`${base}/IncomingPhoneNumbers/${sid}.json`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const updated = await updateRes.json();

  if (updateRes.ok && updated.voice_url === VOICE_URL) {
    console.log('✅ Webhook set successfully!');
    console.log(`   voice_url:    ${updated.voice_url}`);
    console.log(`   voice_method: ${updated.voice_method}`);
  } else {
    console.error('❌ Update failed:', JSON.stringify(updated, null, 2));
  }
}

// ─── Vercel: list env vars and report which exist ─────────────────────────────
async function checkVercelEnv() {
  console.log('\n🔧 VERCEL: Checking environment variables...');

  // Try to read Vercel token from local CLI config
  const os   = await import('os');
  const fs   = await import('fs');
  const path = await import('path');

  const configPaths = [
    path.join(os.homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json'),
    path.join(os.homedir(), '.config', 'vercel', 'auth.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'auth.json'),
  ];

  let token = null;
  for (const p of configPaths) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      token = data.token;
      if (token) { console.log(`   Auth token found at: ${p}`); break; }
    } catch {}
  }

  if (!token) {
    console.log('   ⚠️  No Vercel CLI token found locally.');
    console.log('   To check env vars, run: vercel env ls --token=<your-token>');
    console.log('   Or go to: https://vercel.com/alexsbourne-5116s-projects/no-agents/settings/environment-variables');
    return;
  }

  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();

  if (!res.ok) {
    console.error('❌ Vercel API error:', data.error?.message || JSON.stringify(data));
    return;
  }

  const envKeys = data.envs.map(e => e.key);
  const required = ['ANTHROPIC_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];

  console.log('\n   Env var status:');
  for (const key of required) {
    const exists = envKeys.includes(key);
    console.log(`   ${exists ? '✅' : '❌'} ${key} — ${exists ? 'EXISTS' : 'MISSING'}`);
  }

  const missing = required.filter(k => !envKeys.includes(k));
  if (missing.length) {
    console.log('\n   ⚠️  Missing env vars need to be added in Vercel before the voice agent works.');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await setTwilioWebhook();
    await checkVercelEnv();
    console.log('\nDone.\n');
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
