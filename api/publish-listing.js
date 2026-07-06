// api/publish-listing.js
// Generates REAXML and pushes to REA + Domain via FTP
// Called automatically when a seller completes payment

import * as ftp from 'basic-ftp';
import { Readable } from 'stream';
import { notifyAdmin } from './notify-admin.js';

// ── REAXML Generator ────────────────────────────────────────────────────────
function generateREAXML(listing) {
  const {
    uniqueId,       // e.g. "NA-001"
    agentId,        // REA agency ID (set in env)
    address,        // "12/47 Queens Road, Brisbane City QLD 4000"
    suburb,
    state,
    postcode,
    streetNumber,
    streetName,
    unitNumber,
    beds,
    baths,
    cars,
    price,          // numeric
    priceView,      // e.g. "Offers over $720,000"
    description,
    propertyType,   // "Apartment" | "House" | "Unit" | "Townhouse"
    agentName,
    agentEmail,
    agentPhone,
    agencyName,
    images,         // array of public URLs
    headline,
    deadline,       // ISO date string
  } = listing;

  const typeMap = {
    'Apartment': 'apartment', 'Unit': 'unit',
    'House': 'house', 'Townhouse': 'townhouse', 'Villa': 'villa'
  };
  const reaType = typeMap[propertyType] || 'apartment';

  const imageXml = (images || []).slice(0, 25).map((url, i) =>
    `    <img id="${i + 1}" modTime="${new Date().toISOString().replace(/\.\d+Z/, '+00:00')}" format="jpg" url="${url}"/>`
  ).join('\n');

  const now = new Date().toISOString().replace(/\.\d+Z/, '+00:00');
  const modTime = now;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE propertyList SYSTEM "http://reaxml.realestate.com.au/propertyList.dtd">
<propertyList dateTimeCreated="${modTime}" username="${process.env.REA_USERNAME}" password="${process.env.REA_PASSWORD}">
  <residential status="current" modTime="${modTime}" uniqueID="${uniqueId}">
    <agentID>${agentId || process.env.REA_AGENT_ID}</agentID>
    <authority value="forsale"/>
    <underOffer value="no"/>
    <price display="yes">${price}</price>
    <priceView>${priceView || `Offers over $${Number(price).toLocaleString()}`}</priceView>
    <address>
      <lotNumber/>
      ${unitNumber ? `<unitNumber>${unitNumber}</unitNumber>` : ''}
      <streetNumber>${streetNumber}</streetNumber>
      <street>${streetName}</street>
      <suburb>${suburb}</suburb>
      <state>${state || 'QLD'}</state>
      <postcode>${postcode}</postcode>
      <country value="Australia"/>
    </address>
    <category value="${reaType}"/>
    <features>
      <bedrooms>${beds || 0}</bedrooms>
      <bathrooms>${baths || 0}</bathrooms>
      <garages>${cars || 0}</garages>
    </features>
    <description><![CDATA[${description}]]></description>
    <headline><![CDATA[${headline || `${beds} bed ${propertyType} in ${suburb}`}]]></headline>
    <listingAgent>
      <name>${agentName || 'Alexander Bourne'}</name>
      <email>${agentEmail || 'alexander@no-agents.com.au'}</email>
      <telephones>
        <telephone type="mobile" input="${agentPhone || '0485043210'}"/>
      </telephones>
    </listingAgent>
    ${imageXml ? `<objects>\n${imageXml}\n    </objects>` : ''}
    <inspectionTimes/>
    <vendorDetails>
      <name>${agencyName || 'No Agents Pty Ltd'}</name>
    </vendorDetails>
  </residential>
</propertyList>`;
}

// ── FTP Push ─────────────────────────────────────────────────────────────
async function pushToPortal(xmlContent, portalConfig, listingId) {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host:     portalConfig.host,
      user:     portalConfig.user,
      password: portalConfig.password,
      secure:   portalConfig.secure || false,
    });

    const filename = `${listingId}.xml`;
    const stream = Readable.from([xmlContent]);
    await client.uploadFrom(stream, filename);

    console.log(`✓ Pushed ${filename} to ${portalConfig.name}`);
    return { success: true, portal: portalConfig.name, filename };
  } catch (err) {
    console.error(`✗ Failed to push to ${portalConfig.name}:`, err.message);
    return { success: false, portal: portalConfig.name, error: err.message };
  } finally {
    client.close();
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { listing, portal = 'domain' } = req.body || {};
  // portal: 'domain' (default → Phase 1 on payment)
  //         'rea'    (Phase 2 → after Domain photos confirmed)
  //         'both'   (simultaneous, for testing)

  if (!listing) return res.status(400).json({ error: 'listing object required' });

  // Hard stop: never push an ad to a portal without photos — this is the
  // whole point of the pending/photo-ready gate upstream. Defense in depth
  // in case a future caller forgets to check.
  if (!Array.isArray(listing.images) || listing.images.length === 0) {
    return res.status(400).json({ error: 'Cannot publish a listing with no photos' });
  }

  // Validate required fields
  const required = ['uniqueId', 'address', 'suburb', 'postcode', 'streetNumber', 'streetName', 'beds', 'baths', 'price', 'description'];
  const missing = required.filter(f => !listing[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Generate XML
  const xml = generateREAXML(listing);

  // Portal configs from env vars — only include portals requested
  const portals = [];

  if ((portal === 'rea' || portal === 'both') && process.env.REA_FTP_HOST) {
    portals.push({
      name:     'realestate.com.au',
      host:     process.env.REA_FTP_HOST,
      user:     process.env.REA_FTP_USER,
      password: process.env.REA_FTP_PASS,
      secure:   process.env.REA_FTP_SECURE === 'true',
    });
  }

  if ((portal === 'domain' || portal === 'both') && process.env.DOMAIN_FTP_HOST) {
    portals.push({
      name:     'domain.com.au',
      host:     process.env.DOMAIN_FTP_HOST,
      user:     process.env.DOMAIN_FTP_USER,
      password: process.env.DOMAIN_FTP_PASS,
      secure:   process.env.DOMAIN_FTP_SECURE === 'true',
    });
  }

  if (portals.length === 0) {
    return res.status(200).json({
      success: true,
      message: `XML generated for portal="${portal}" — no FTP credentials configured yet`,
      xml,
      note: 'Add REA_FTP_HOST, REA_FTP_USER, REA_FTP_PASS (and DOMAIN_*) to Vercel env vars',
    });
  }

  // Push to all configured portals in parallel
  const results = await Promise.all(
    portals.map(p => pushToPortal(xml, p, listing.uniqueId))
  );

  const allOk = results.every(r => r.success);
  if (!allOk) {
    await notifyAdmin({
      subject: `Listing FTP push failed — ${listing.uniqueId}`,
      html: `<p>Pushing <strong>${listing.address}</strong> to a portal failed.</p>
<ul>${results.map(r => `<li>${r.portal}: ${r.success ? '✅ ok' : '❌ ' + r.error}</li>`).join('')}</ul>`,
      isError: true,
    });
  }
  return res.status(allOk ? 200 : 207).json({
    success: allOk,
    results,
    xml: process.env.NODE_ENV !== 'production' ? xml : undefined,
  });
}
