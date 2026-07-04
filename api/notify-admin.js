// api/notify-admin.js
// Shared helper: fire-and-forget email alert to the CEO for every stage of the
// seller journey (payment, publish, offers, contract, settlement) plus errors.
//
// Usage:
//   import { notifyAdmin } from './notify-admin.js';
//   await notifyAdmin({ subject: '...', html: '...' });
//
// Never throws — a notification failure must not break the calling request.

const ADMIN_EMAIL = 'alexander@no-agents.com.au';

export async function notifyAdmin({ subject, html, isError = false }) {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    console.warn('[notify-admin] RESEND_API_KEY not set — skipping admin alert:', subject);
    return { sent: false, reason: 'no_api_key' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents Alerts <office@no-agents.com.au>',
        to: [ADMIN_EMAIL],
        subject: `${isError ? '⚠️ ' : ''}${subject}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notify-admin] Resend API error:', res.status, body);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[notify-admin] send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}
