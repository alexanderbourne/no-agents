// api/mortgage-broker.js
// Buyer-side finance referral. Unlike the conveyancing partner, this
// relationship isn't sensitive to name — the broker's contact details still
// live in env vars (not hardcoded) purely so they can be updated without a
// code change, not to hide who they are.
//
// Surfaced to buyers who have a finance condition on their offer (see
// index.html ContractSign) via api/contract.js action=request-mortgage-broker.
//
// Required env vars: DEFAULT_MORTGAGE_BROKER_EMAIL, DEFAULT_MORTGAGE_BROKER_NAME (optional), RESEND_API_KEY

const { RESEND_API_KEY, DEFAULT_MORTGAGE_BROKER_EMAIL, DEFAULT_MORTGAGE_BROKER_NAME } = process.env;

export function getMortgageBroker() {
  if (!DEFAULT_MORTGAGE_BROKER_EMAIL) return null;
  return { name: DEFAULT_MORTGAGE_BROKER_NAME || null, email: DEFAULT_MORTGAGE_BROKER_EMAIL };
}

export async function notifyMortgageBroker({ buyerName, buyerEmail, buyerPhone, address }) {
  const broker = getMortgageBroker();
  if (!RESEND_API_KEY || !broker?.email) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'No Agents <office@no-agents.com.au>',
        to: [broker.email],
        subject: `Finance referral — ${buyerName || 'a buyer'} (${address})`,
        html: `<div style="font-family:sans-serif;max-width:500px;">
          <h2>New finance referral</h2>
          <p>A buyer on no-agents.com.au has a finance condition on their accepted offer for <strong>${address}</strong> and asked to be connected with a broker.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr><td style="padding:6px 12px;color:#666;width:100px;">Name</td><td style="padding:6px 12px;font-weight:600;">${buyerName || '—'}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:6px 12px;color:#666;">Email</td><td style="padding:6px 12px;">${buyerEmail || '—'}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Phone</td><td style="padding:6px 12px;">${buyerPhone || '—'}</td></tr>
          </table>
          <p style="font-size:12px;color:#999;">Sent automatically by no-agents.com.au. Reply directly to the buyer to proceed.</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('notifyMortgageBroker failed:', e.message);
    return false;
  }
}
