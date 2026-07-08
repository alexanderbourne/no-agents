// api/entry-notice.js
// Notifies the tenant on file when an inspection is confirmed for a tenanted
// listing, by issuing the ACTUAL Queensland RTA "Entry notice (Form 9)" —
// the form prescribed under the Residential Tenancies and Rooming
// Accommodation Act 2008 (ss 192-199) — not a custom-drafted substitute.
// See api/entry-notice-pdf.js for how the official template is filled.
//
// The RTA minimum for this ground ("show the property to a prospective
// purchaser or tenant") is 48 hours — see the form's own "Schedule of
// timeframes" (page 2 of api/assets/form9-entry-notice.pdf).
//
// Called automatically on confirm from api/inspections.js and
// api/agent-portal.js (action=claim). Also invoked for a manual resend via
// api/seller-portal.js (action=send-entry-notice), for when the automatic
// send failed (e.g. tenant email added after the fact) or the seller wants
// a fresh copy sent.
//
// Never throws — a notice failure must not block an inspection being
// recorded. Failures are surfaced to admin instead.

import twilio from 'twilio';
import { put } from '@vercel/blob';
import { notifyAdmin } from './notify-admin.js';
import { fillEntryNoticeForm9 } from './entry-notice-pdf.js';

const { RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const MIN_NOTICE_HOURS = 48;

function normalisePhone(raw) {
  const trimmed = (raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  if (trimmed.startsWith('+')) return trimmed;
  return '+' + digits;
}

// Best-effort parse of the free-text date/time strings used elsewhere in the
// booking flow (e.g. "Sat 31 May", "10:00am"). If it can't be parsed into a
// real Date, compliance is reported as null (unknown) rather than guessing —
// a false "compliant" would be worse than an honest "couldn't verify".
export function checkNoticeCompliance(date, time) {
  const parsed = new Date(`${date} ${time || ''}`.trim());
  if (isNaN(parsed.getTime())) return { compliant: null, hoursNotice: null };
  const hoursNotice = (parsed.getTime() - Date.now()) / (1000 * 60 * 60);
  return { compliant: hoursNotice >= MIN_NOTICE_HOURS, hoursNotice: Math.round(hoursNotice) };
}

async function sendEmail(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'No Agents <office@no-agents.com.au>', to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => '')}`);
}

async function sendSms(to, body) {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  await client.messages.create({ to, from: TWILIO_PHONE_NUMBER, body });
}

// { listing, inspection: {date, time, agentName, buyerName} } →
// { sent, emailed, texted, compliant, hoursNotice, fileUrl, reason }
export async function sendEntryNotice({ listing, inspection }) {
  const tenant = listing?.tenant;
  if (!tenant?.tenanted) return { sent: false, reason: 'not_tenanted' };
  if (!tenant.email && !tenant.phone) return { sent: false, reason: 'no_tenant_contact' };

  const { compliant, hoursNotice } = checkNoticeCompliance(inspection.date, inspection.time);
  const whenLine = `${inspection.date}${inspection.time ? ' at ' + inspection.time : ''}`;
  const issuedAt = new Date();
  const issueMethods = [tenant.email && 'Email', tenant.phone && 'SMS'].filter(Boolean);

  const entrants = [
    inspection.agentName ? { name: inspection.agentName } : (listing.sellerName ? { name: listing.sellerName, phone: listing.sellerPhone || '' } : null),
    inspection.buyerName ? { name: inspection.buyerName } : null,
  ].filter(Boolean);

  // Generate the actual government form — a real signed document, not a
  // paraphrase — and host it so both the tenant and admin have a durable
  // copy. PDF generation/storage failing must not block the notice email
  // itself going out with the plain-text notice as a fallback.
  let fileUrl = null;
  try {
    const pdfBytes = await fillEntryNoticeForm9({ listing, inspection, issuedAt, entrants, issueMethods });
    const blob = await put(`entry-notices/${listing.id}-${Date.now()}.pdf`, Buffer.from(pdfBytes), {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });
    fileUrl = blob.url;
  } catch (e) {
    console.error('[entry-notice] Form 9 PDF generation/upload failed:', e.message);
  }

  const result = { sent: false, emailed: false, texted: false, compliant, hoursNotice, fileUrl, sentAt: issuedAt.toISOString() };

  if (tenant.email && RESEND_API_KEY) {
    try {
      await sendEmail(
        tenant.email,
        `Entry notice (Form 9) — inspection at ${listing.address}`,
        `<div style="font-family:sans-serif;max-width:500px;">
          <h2>Notice of entry (Form 9)</h2>
          <p>Hi ${tenant.name || 'there'},</p>
          <p>Attached is your official Queensland RTA Entry Notice (Form 9), giving notice of a property inspection at <strong>${listing.address}${listing.suburb ? ', ' + listing.suburb : ''}</strong> on <strong>${whenLine}</strong>, to show the property to a prospective purchaser.</p>
          <p>Under the Residential Tenancies and Rooming Accommodation Act 2008 (Qld), a minimum of 48 hours' notice is required for this ground of entry.</p>
          ${fileUrl ? `<p><a href="${fileUrl}">Download your Entry Notice (Form 9) →</a></p>` : `<p style="color:#b00">We couldn't attach the completed form automatically — contact the owner if you'd like a copy.</p>`}
          <p>If this time doesn't suit, contact the owner directly as soon as possible.</p>
        </div>`
      );
      result.emailed = true;
    } catch (e) { console.error('[entry-notice] email failed:', e.message); }
  }

  if (tenant.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    const to = normalisePhone(tenant.phone);
    if (to) {
      try {
        await sendSms(to, `No Agents entry notice (Form 9): Inspection at ${listing.address} on ${whenLine}. Min. 48hrs notice required under QLD RTA.${fileUrl ? ` Copy: ${fileUrl}` : ''} Contact the owner if this time doesn't suit.`);
        result.texted = true;
      } catch (e) { console.error('[entry-notice] SMS failed:', e.message); }
    }
  }

  result.sent = result.emailed || result.texted;

  if (!result.sent) {
    await notifyAdmin({
      subject: `Entry notice FAILED to send — ${listing.address}`,
      html: `<p>An inspection was confirmed at <strong>${listing.address}</strong> for a tenanted property on ${whenLine}, but the Form 9 entry notice could not be sent to the tenant (${tenant.email || tenant.phone || 'no contact'}). Notify them manually — QLD RTA requires 48 hours' notice.</p>${fileUrl ? `<p><a href="${fileUrl}">Download the generated Form 9 →</a> — send it to the tenant yourself.</p>` : ''}`,
      isError: true,
    });
  } else if (compliant === false) {
    await notifyAdmin({
      subject: `Entry notice sent but under 48hrs notice — ${listing.address}`,
      html: `<p>An inspection was confirmed at <strong>${listing.address}</strong> for ${whenLine} — only ~${hoursNotice} hours from now. The tenant was sent a Form 9, but this falls short of the 48-hour minimum required under the QLD RTA. Consider rescheduling.</p>`,
      isError: true,
    });
  } else if (compliant === null) {
    await notifyAdmin({
      subject: `Entry notice sent — could not verify 48hr compliance — ${listing.address}`,
      html: `<p>An inspection was confirmed at <strong>${listing.address}</strong> for "${whenLine}" and the tenant was sent a Form 9, but the date/time couldn't be parsed to confirm it clears the 48-hour QLD RTA minimum. Double-check manually.</p>`,
    });
  } else if (!fileUrl) {
    await notifyAdmin({
      subject: `Entry notice sent without the Form 9 attachment — ${listing.address}`,
      html: `<p>The tenant at <strong>${listing.address}</strong> was notified of the inspection on ${whenLine}, but the official Form 9 PDF failed to generate/upload — they only received the plain-text notice. Check function logs and consider sending the form manually.</p>`,
      isError: true,
    });
  }

  return result;
}
