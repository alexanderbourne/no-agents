// api/entry-notice-pdf.js
// Fills the ACTUAL Queensland RTA "Entry notice (Form 9)" — the form
// prescribed under the Residential Tenancies and Rooming Accommodation Act
// 2008 (ss 192-199) — rather than a custom-drafted substitute. The template
// is the unmodified PDF downloaded from the RTA:
//   https://www.rta.qld.gov.au/forms-resources/forms/forms-for-general-tenancies/entry-notice-form-9
// (v20, Nov 2025), bundled at api/assets/form9-entry-notice.pdf.
//
// Field names below were taken directly from the template's AcroForm fields
// (inspected with pdf-lib) and matched to their on-page labels by position.
// If the RTA republishes the form with different field names, filling will
// log a warning per unmatched field rather than throw — see `set`/`check`.

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const TEMPLATE_PATH = path.join(process.cwd(), 'api/assets/form9-entry-notice.pdf');

// Section 5 "Entry is sought under the following grounds" — 10 checkboxes in
// the exact order printed on the form. Ground 7 (0-based index 6) is
// "Show the property to a prospective purchaser or tenant (48 hours notice)",
// the ground that applies to a sale-related buyer inspection.
const GROUND_SHOW_TO_BUYER_CHECKBOX = 'Checkbox7';

function dayName(date) {
  return date && !isNaN(date.getTime()) ? date.toLocaleDateString('en-AU', { weekday: 'long' }) : '';
}
function dmy(date) {
  return date && !isNaN(date.getTime()) ? date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}

/**
 * @param {object} params
 * @param {object} params.listing — the listing, including .tenant, .address, .suburb, .state, .postcode
 * @param {{date: string, time: string}} params.inspection — the confirmed entry date/time (free text as captured elsewhere in the app)
 * @param {Date} params.issuedAt — when this notice is being issued (now)
 * @param {{name: string, phone?: string}[]} params.entrants — people who will physically enter (agent/owner, buyer)
 * @param {string[]} params.issueMethods — e.g. ['Email'], ['Email','SMS']
 * @returns {Promise<Uint8Array>} the filled, flattened PDF bytes
 */
export async function fillEntryNoticeForm9({ listing, inspection, issuedAt, entrants = [], issueMethods = ['Email'] }) {
  const bytes = fs.readFileSync(TEMPLATE_PATH);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  const set = (name, value) => {
    try { form.getTextField(name).setText(value ? String(value) : ''); }
    catch (e) { console.warn(`[entry-notice-pdf] text field "${name}" not found/settable:`, e.message); }
  };
  const check = (name) => {
    try { form.getCheckBox(name).check(); }
    catch (e) { console.warn(`[entry-notice-pdf] checkbox "${name}" not found:`, e.message); }
  };

  const tenant = listing.tenant || {};
  const entryDate = new Date(`${inspection.date} ${inspection.time || ''}`.trim());

  // Name/s and address of the tenant/s
  set('Name/s of tenant/s', tenant.name || '');
  set('Address1', listing.address || tenant.address || '');
  set('Address 2', [listing.suburb, listing.state].filter(Boolean).join(' '));
  set('Postcode 1', listing.postcode || '');
  // Section 1 "Address of the rental property (if different from above)" is
  // deliberately left blank — the tenant's address IS the rental property.

  // Section 2 — notice issued by. No Agents acts as the agent selling the
  // premises (a "secondary agent" under the form's own terminology) — the
  // form's instructions state sale-related notices must come from this role.
  check('Other authorised person (secondary agent)');
  set('Full name or trading name', 'No Agents Pty Ltd (Alexander Bourne, Licence 4542501)');
  set('Phone number', '0485043210');

  // Section 3 — details of all people entering
  const entrantFields = [
    ['Full name or trading name 1', 'Phone number 1'],
    ['Full name or trading name 2', 'Phone number 2'],
    ['Full name or trading name 3', 'Phone number 3'],
  ];
  entrants.slice(0, 3).forEach((e, i) => {
    set(entrantFields[i][0], e.name || '');
    set(entrantFields[i][1], e.phone || '');
  });

  // Section 4 — notice issued on
  set('Day 1', dayName(issuedAt));
  set('Date (dd/mm/yyyy)1', dmy(issuedAt));
  set('Method of issue 1', issueMethods.join(' and '));

  // Section 5 — ground for entry
  check(GROUND_SHOW_TO_BUYER_CHECKBOX);

  // Section 6 — entry date/time. Dates/times elsewhere in this app are
  // free-text strings, not guaranteed to parse — fall back to the raw text
  // if that happens, rather than leaving the form blank.
  set('Day 2', dayName(entryDate) || '');
  set('Date (dd/mm/yyyy) 2', isNaN(entryDate.getTime()) ? inspection.date : dmy(entryDate));
  set('Time of entry', inspection.time || '');

  // Section 7 — signature block. "Print name" is filled; the signature
  // itself is deliberately left blank (no image is drawn) — this notice is
  // system-issued, not hand-signed, so we don't fabricate a signature. Date
  // of signature reflects the actual issue date.
  set('Print name', 'Alexander Bourne, No Agents Pty Ltd');
  set('Date of signature (dd/mm/yyyy)', dmy(issuedAt));

  form.flatten();
  return doc.save();
}
