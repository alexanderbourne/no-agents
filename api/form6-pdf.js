// api/form6-pdf.js
// Renders a signed Form 6 — Exclusive Sales Agency Agreement as a PDF.
//
// This is our plain-English record of the appointment (property, fee terms,
// signatory, timestamp, signature image) — not a reproduction of the official
// REIQ Form 6 stationery. It exists so a signed agency appointment has a
// durable, downloadable document behind it instead of only a database row.
//
// Used by api/seller-portal.js (action=sign-form6).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 56;

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
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - MARGIN;
  const lh = (size) => size * 1.4;

  const draw = (text, { size = 10.5, f = font, color = rgb(0.1, 0.1, 0.1), gap = 0 } = {}) => {
    page.drawText(text, { x: MARGIN, y, size, font: f, color });
    y -= lh(size) + gap;
  };

  const wrap = (text, size, f, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawParagraph = (text, { size = 9.5, f = font, color = rgb(0.25, 0.25, 0.25), gap = 10 } = {}) => {
    const maxWidth = PAGE_W - MARGIN * 2;
    for (const line of wrap(text, size, f, maxWidth)) draw(line, { size, f, color });
    y -= gap;
  };

  draw('Form 6 — Exclusive Sales Agency Agreement', { size: 18, f: bold, gap: 4 });
  draw('No Agents Pty Ltd · ABN 18 642 813 438 · Queensland Real Estate Licence 4542501', { size: 9.5, color: rgb(0.4, 0.4, 0.4), gap: 18 });

  draw('Property', { size: 11, f: bold, gap: 2 });
  draw(`${listing.address}, ${listing.suburb} ${listing.state || 'QLD'} ${listing.postcode || ''}`.trim(), { size: 10.5, gap: 14 });

  draw('Seller', { size: 11, f: bold, gap: 2 });
  draw(listing.sellerName || signedByName, { size: 10.5, gap: 2 });
  if (listing.sellerEmail) draw(listing.sellerEmail, { size: 10.5, gap: 2 });
  if (listing.sellerPhone) draw(listing.sellerPhone, { size: 10.5 });
  y -= 12;

  draw('Fee terms', { size: 11, f: bold, gap: 2 });
  for (const line of feeTermsFor(listing)) draw(line, { size: 10.5, gap: 2 });
  y -= 12;

  draw('Appointment', { size: 11, f: bold, gap: 4 });
  drawParagraph(
    `By signing below, the seller appoints No Agents Pty Ltd (Licence 4542501) as their exclusive selling agent for the above property, on the fee terms stated above — no commission is charged at any stage. This appointment authorises No Agents Pty Ltd to market and sell the property on the seller's behalf for the duration of the listing, confirms the agreed fee structure and the seller's obligations, and constitutes the seller's authority to instruct us in line with the Property Occupations Act 2014 (QLD).`
  );

  y -= 20;
  draw('Signature', { size: 11, f: bold, gap: 8 });

  if (signatureImage) {
    try {
      const isPng = signatureImage.startsWith('data:image/png');
      const base64 = signatureImage.split(',')[1] || '';
      const bytes = Buffer.from(base64, 'base64');
      const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxW = 220, maxH = 90;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: MARGIN, y: y - h, width: w, height: h });
      y -= h + 10;
    } catch (e) {
      console.error('[form6-pdf] signature embed failed:', e.message);
      draw('(signature image could not be rendered)', { size: 9.5, color: rgb(0.6, 0.2, 0.2) });
    }
  }

  draw(`Signed by: ${signedByName}`, { size: 10.5, gap: 2 });
  draw(`Signed at: ${new Date(signedAt).toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })}`, { size: 10.5 });

  return doc.save();
}
