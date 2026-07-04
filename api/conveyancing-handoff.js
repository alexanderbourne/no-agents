// api/conveyancing-handoff.js
// Once both parties have signed the Heads of Agreement, hand the case off to
// whichever conveyancer/solicitor the seller nominated in their dashboard
// Settings tab (see api/seller-portal.js, action=update-details).
//
// We do not have a signed conveyancing referral partner (see ToS s.6) — this
// notifies the seller's own chosen conveyancer, not a No Agents partner.
//
// Never throws — a notification failure must not block the signing flow.

const { RESEND_API_KEY } = process.env;

export async function notifyConveyancer(listing) {
  const conveyancer = listing.conveyancer;
  if (!RESEND_API_KEY || !conveyancer?.email) return false;

  const c = listing.contract || {};
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents <office@no-agents.com.au>',
        to: [conveyancer.email],
        subject: `New case — Heads of Agreement signed — ${listing.address}`,
        html: `<div style="font-family:sans-serif;max-width:560px;">
          <h2>Heads of Agreement signed — new case</h2>
          <p>${listing.sellerName || 'Your client'} has nominated you to prepare the Contract of Sale for the sale below via no-agents.com.au (Licence 4542501, QLD). Both parties have signed the summary of agreed terms.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr><td style="padding:6px 12px;color:#666;width:170px;">Property</td><td style="padding:6px 12px;font-weight:600;">${listing.address}, ${listing.suburb || ''} ${listing.state || 'QLD'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Sale price</td><td style="padding:6px 12px;font-weight:600;">$${(c.amount || 0).toLocaleString()}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Settlement</td><td style="padding:6px 12px;">${c.settlement || '—'} days from signing</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Finance condition</td><td style="padding:6px 12px;">${c.finance ? `Yes — ${c.financeDays || '—'} days` : 'No'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Building & pest condition</td><td style="padding:6px 12px;">${c.building ? `Yes — ${c.buildingDays || '—'} days` : 'No'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Deposit</td><td style="padding:6px 12px;">Initial ${c.initialDeposit || '—'}, balance ${c.balanceDeposit || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Cooling-off</td><td style="padding:6px 12px;">${c.coolingOff || '—'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Conditions / notes</td><td style="padding:6px 12px;">${c.conditions || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Seller</td><td style="padding:6px 12px;">${listing.sellerName || '—'} · ${listing.sellerEmail || '—'} · ${listing.sellerPhone || '—'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Buyer</td><td style="padding:6px 12px;">${c.buyerName || '—'} · ${c.buyerEmail || '—'} · ${c.buyerPhone || '—'}</td></tr>
          </table>
          <p style="font-size:12px;color:#999;">Sent automatically by no-agents.com.au on behalf of your client. Reply directly to them to proceed.</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('notifyConveyancer failed:', e.message);
    return false;
  }
}
