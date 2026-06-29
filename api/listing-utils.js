// api/listing-utils.js
// Shared utilities for listing creation and address parsing
// No Agents Pty Ltd | no-agents.com.au

/**
 * Parse a freeform Australian address string into components.
 * Handles formats like:
 *   "12 Smith Street, Brisbane City QLD 4000"
 *   "5/47 Queens Road, Paddington QLD 4064"
 *   "12 Smith St Brisbane City QLD 4000"
 */
function parseAddress(raw) {
  if (!raw) return { streetNumber: '', streetName: '', unitNumber: '', suburb: '', state: 'QLD', postcode: '' };

  // Strip suburb/state/postcode from end: "... Brisbane City QLD 4000"
  const postcodeMatch = raw.match(/\b(\d{4})\s*$/);
  const postcode = postcodeMatch ? postcodeMatch[1] : '';
  let remainder = postcodeMatch ? raw.slice(0, postcodeMatch.index).trim() : raw;

  // Strip trailing state abbreviation
  const stateMatch = remainder.match(/\b(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)\s*,?\s*$/i);
  const state = stateMatch ? stateMatch[1].toUpperCase() : 'QLD';
  if (stateMatch) remainder = remainder.slice(0, stateMatch.index).trim();

  // Split on comma: "street part, suburb" or just "street part suburb"
  const commaParts = remainder.split(',').map(s => s.trim());
  let streetPart, suburb;

  if (commaParts.length >= 2) {
    streetPart = commaParts[0];
    suburb = commaParts.slice(1).join(', ').trim();
  } else {
    // No comma — try to find suburb as last 1-3 words after postcode guess
    const words = remainder.split(/\s+/);
    // Heuristic: street part is first 2-4 words, suburb is the rest
    const splitAt = Math.min(4, Math.max(2, words.length - 2));
    streetPart = words.slice(0, splitAt).join(' ');
    suburb = words.slice(splitAt).join(' ');
  }

  // Parse unit number from street part: "5/47 Queens Road" or "Unit 5, 47 Queens Road"
  let unitNumber = '';
  let streetNumber = '';
  let streetName = '';

  const unitSlashMatch = streetPart.match(/^(\d+)\s*\/\s*(\d+[A-Za-z]?)\s+(.+)$/);
  if (unitSlashMatch) {
    unitNumber  = unitSlashMatch[1];
    streetNumber = unitSlashMatch[2];
    streetName  = unitSlashMatch[3];
  } else {
    const basicMatch = streetPart.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
    if (basicMatch) {
      streetNumber = basicMatch[1];
      streetName   = basicMatch[2];
    } else {
      streetName = streetPart;
    }
  }

  return {
    unitNumber:   unitNumber.trim(),
    streetNumber: streetNumber.trim(),
    streetName:   streetName.trim(),
    suburb:       suburb.trim(),
    state:        state.trim(),
    postcode:     postcode.trim(),
  };
}

/**
 * Generate a unique listing ID.
 * Format: {prefix}-{YYYYMMDD}-{random5}
 * Example: NA-20260610-x7k2m
 */
function generateListingId(prefix = 'NA') {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

export { parseAddress, generateListingId };
