// api/form6-pdf.js
// Renders a signed Form 6 — Exclusive Sales Agency Agreement as a PDF.
//
// This is our plain-English record of the appointment (property, fee terms,
// signatory, timestamp, signature image) — not a reproduction of the official
// REIQ Form 6 stationery. It exists so a signed agency appointment has a
// durable, downloadable document behind it instead of only a database row.
//
// Used by api/seller-portal.js (action=sign-form6).

import { createPdfWriter } from './pdf-writer.js';

function feeTermsFor(listing) {
  if (listing.tier === 'assisted') {
    return [
      'Fee: $798 (excl. GST) upfront, plus a success fee of 0.5% of the final sale price',
      'capped at $15,000 (AUD), payable only if and when the property settles.',
    ];
  }
  return [
    'Fee: $798 (excl. GST) flat, one-time. No commission and no success fee at any stage.',
  ];
}

export async function renderForm6Pdf({ listing, signedByName, signedAt, signatureImage }) {
  const w = await createPdfWriter();

  w.draw('Form 6 — Exclusive Sales Agency Agreement', { size: 18, f: w.bold, gap: 4 });
  w.draw('No Agents Pty Ltd · ABN 18 642 813 438 · Queensland Real Estate Licence 4542501', { size: 9.5, color: [0.4, 0.4, 0.4], gap: 18 });

  w.draw('Property', { size: 11, f: w.bold, gap: 2 });
  w.draw(`${listing.address}, ${listing.suburb} ${listing.state || 'QLD'} ${listing.postcode || ''}`.trim(), { size: 10.5, gap: 14 });

  w.draw('Seller', { size: 11, f: w.bold, gap: 2 });
  w.draw(listing.sellerName || signedByName, { size: 10.5, gap: 2 });
  if (listing.sellerEmail) w.draw(listing.sellerEmail, { size: 10.5, gap: 2 });
  if (listing.sellerPhone) w.draw(listing.sellerPhone, { size: 10.5 });
  w.space(12);

  w.draw('Fee terms', { size: 11, f: w.bold, gap: 2 });
  for (const line of feeTermsFor(listing)) w.draw(line, { size: 10.5, gap: 2 });
  w.space(12);

  w.draw('Appointment', { size: 11, f: w.bold, gap: 4 });
  w.drawParagraph(
    `By signing below, the seller appoints No Agents Pty Ltd (Licence 4542501) as their exclusive selling agent for the above property, on the fee terms stated above — no commission is charged at any stage. This appointment authorises No Agents Pty Ltd to market and sell the property on the seller's behalf for the duration of the listing, confirms the agreed fee structure and the seller's obligations, and constitutes the seller's authority to instruct us in line with the Property Occupations Act 2014 (QLD).`
  );

  w.space(20);
  w.draw('Signature', { size: 11, f: w.bold, gap: 8 });

  try {
    await w.drawSignatureImage(signatureImage);
  } catch (e) {
    console.error('[form6-pdf] signature embed failed:', e.message);
    w.draw('(signature image could not be rendered)', { size: 9.5, color: [0.6, 0.2, 0.2] });
  }

  w.draw(`Signed by: ${signedByName}`, { size: 10.5, gap: 2 });
  w.draw(`Signed at: ${new Date(signedAt).toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })}`, { size: 10.5 });

  return w.doc.save();
}
