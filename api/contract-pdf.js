// api/contract-pdf.js
// Renders the fully-executed Heads of Agreement (buyer + seller signed) as a
// PDF, and stores it in Vercel Blob. This is a plain-English summary of the
// agreed terms — not the formal Contract of Sale, which the seller's
// conveyancer prepares separately — but it's the durable record of what both
// parties actually signed, for the same compliance reason as the Form 6 PDF
// (see api/form6-pdf.js): a status flag + signature image in the DB isn't a
// document on its own.
//
// Used by api/contract.js and api/seller-portal.js at the moment the second
// signature lands and the contract becomes fully executed.

import { put } from '@vercel/blob';
import { createPdfWriter } from './pdf-writer.js';

async function renderContractPdf({ listing }) {
  const c = listing.contract;
  const w = await createPdfWriter();

  w.draw('Heads of Agreement', { size: 18, f: w.bold, gap: 4 });
  w.draw('Summary of agreed terms — not the formal Contract of Sale', { size: 9.5, color: [0.4, 0.4, 0.4], gap: 18 });

  w.draw('Property', { size: 11, f: w.bold, gap: 2 });
  w.draw(`${listing.address}, ${listing.suburb} ${listing.state || 'QLD'} ${listing.postcode || ''}`.trim(), { size: 10.5, gap: 14 });

  w.draw('Seller', { size: 11, f: w.bold, gap: 2 });
  w.draw(listing.sellerName || '—', { size: 10.5, gap: 14 });

  w.draw('Buyer', { size: 11, f: w.bold, gap: 2 });
  w.draw(c.buyerName || '—', { size: 10.5, gap: 2 });
  if (c.buyerEmail) w.draw(c.buyerEmail, { size: 10.5, gap: 2 });
  if (c.buyerPhone) w.draw(c.buyerPhone, { size: 10.5 });
  w.space(12);

  w.draw('Terms', { size: 11, f: w.bold, gap: 2 });
  w.draw(`Purchase price: $${(c.amount || 0).toLocaleString()}`, { size: 10.5, gap: 2 });
  w.draw(`Settlement: ${c.settlement} days`, { size: 10.5, gap: 2 });
  w.draw(`Deposit: $${c.initialDeposit || '—'} initial, ${c.balanceDeposit || '—'}% balance`, { size: 10.5, gap: 2 });
  if (c.coolingOff) w.draw(`Cooling-off: ${c.coolingOff}`, { size: 10.5, gap: 2 });
  if (c.finance) w.draw(`Finance condition: ${c.financeDays} days`, { size: 10.5, gap: 2 });
  if (c.building) w.draw(`Building & pest condition: ${c.buildingDays} days`, { size: 10.5, gap: 2 });
  if (c.conditions) w.draw(`Other conditions: ${c.conditions}`, { size: 10.5, gap: 2 });
  w.space(12);

  w.drawParagraph(
    'This document records the terms both parties agreed to. It is not legally binding on its own — a legally binding sale requires execution of a formal Contract of Sale prepared by a licensed conveyancer or solicitor.'
  );

  w.space(10);
  w.draw('Buyer signature', { size: 11, f: w.bold, gap: 8 });
  await w.drawSignatureImage(c.buyerSigned?.signatureImage);
  w.draw(`Signed by: ${c.buyerSigned?.signedByName || '—'}`, { size: 10.5, gap: 2 });
  w.draw(`Signed at: ${c.buyerSigned?.signedAt ? new Date(c.buyerSigned.signedAt).toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' }) : '—'}`, { size: 10.5 });

  w.space(16);
  w.draw('Seller signature', { size: 11, f: w.bold, gap: 8 });
  await w.drawSignatureImage(c.sellerSigned?.signatureImage);
  w.draw(`Signed by: ${c.sellerSigned?.signedByName || '—'}`, { size: 10.5, gap: 2 });
  w.draw(`Signed at: ${c.sellerSigned?.signedAt ? new Date(c.sellerSigned.signedAt).toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' }) : '—'}`, { size: 10.5 });

  return w.doc.save();
}

// Renders + uploads, returning the blob URL, or null on any failure. Never
// throws — a storage failure must not block the signing request that
// triggered it; the caller is responsible for surfacing the null result
// (e.g. flagging an admin alert) since the signature itself still saved.
export async function storeContractPdf(listing) {
  try {
    const pdfBytes = await renderContractPdf({ listing });
    const blob = await put(`heads-of-agreement/${listing.id}-${Date.now()}.pdf`, Buffer.from(pdfBytes), {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (e) {
    console.error('[contract-pdf] generation/upload failed:', e.message);
    return null;
  }
}
