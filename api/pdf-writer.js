// api/pdf-writer.js
// Shared low-level layout helpers for signed-document PDFs (Form 6, Heads of
// Agreement). Single A4 page, top-down cursor — these documents are short
// summaries, not multi-page contracts, so no pagination is implemented.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 56;

export async function createPdfWriter() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = PAGE_H - MARGIN;

  const lh = (size) => size * 1.4;
  // Callers pass colors as plain [r,g,b] tuples (0-1 range) so they don't
  // need their own pdf-lib import just for rgb().
  const toColor = (c) => Array.isArray(c) ? rgb(c[0], c[1], c[2]) : c;

  function draw(text, { size = 10.5, f = font, color = [0.1, 0.1, 0.1], gap = 0 } = {}) {
    page.drawText(text, { x: MARGIN, y, size, font: f, color: toColor(color) });
    y -= lh(size) + gap;
  }

  function wrap(text, size, f, maxWidth) {
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
  }

  function drawParagraph(text, { size = 9.5, f = font, color = [0.25, 0.25, 0.25], gap = 10 } = {}) {
    const maxWidth = PAGE_W - MARGIN * 2;
    for (const line of wrap(text, size, f, maxWidth)) draw(line, { size, f, color });
    y -= gap;
  }

  async function drawSignatureImage(signatureImage, { maxW = 220, maxH = 90 } = {}) {
    if (!signatureImage) return;
    const isPng = signatureImage.startsWith('data:image/png');
    const base64 = signatureImage.split(',')[1] || '';
    const bytes = Buffer.from(base64, 'base64');
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale, h = img.height * scale;
    page.drawImage(img, { x: MARGIN, y: y - h, width: w, height: h });
    y -= h + 10;
  }

  function space(gap) { y -= gap; }

  return {
    doc, page, font, bold,
    draw, drawParagraph, drawSignatureImage, space,
    get y() { return y; },
    pageWidth: PAGE_W, pageHeight: PAGE_H, margin: MARGIN,
  };
}
