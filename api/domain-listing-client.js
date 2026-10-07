// api/domain-listing-client.js
// ---------------------------------------------------------------------------
// Pushes listings to Domain via Domain's Listing Management API.
//
// This REPLACES the two dead publishing paths in the existing codebase:
//   - api/feed.js           - a self-hosted REAXML feed for Domain to poll.
//                              Domain confirmed (support ticket #3032256,
//                              29 Sept 2026, "Vin" / Domain API Support):
//                              "Domain no longer sets up new REAXML feed
//                              integrations, so we are not able to poll your
//                              feed." Keep feed.js deployed if you like, but
//                              nothing will ever read it.
//   - api/publish-listing.js (FTP branch) - pushed REAXML over FTP to
//                              DOMAIN_FTP_HOST/REA_FTP_HOST. Those env vars
//                              were never set, so this silently did nothing.
//                              Domain doesn't support FTP intake either -
//                              per Vin: "New listing connections are set up
//                              through our API platform, where your system
//                              sends the listings to Domain through the
//                              Listings Management API." This file is that.
//
// Docs used to build this:
//   https://developer.domain.com.au/docs/latest/apis/pkg_listing_management/guides/upload-listings/
//   Sample request body:
//   https://developer.domain.com.au/static/latest/media/sample_residential_listing.json
//
// ---------------------------------------------------------------------------
// STATUS: Code-complete against Domain's publicly documented API shape.
// NOT YET LIVE - blocked on Domain issuing API credentials (see the
// "STILL NEEDED FROM DOMAIN" list in NEEDED_FROM_DOMAIN.md). Every exported
// function below throws a clear, descriptive error if required env vars are
// missing, rather than failing silently or sending a malformed request.
// ---------------------------------------------------------------------------

const {
    DOMAIN_API_CLIENT_ID,
    DOMAIN_API_CLIENT_SECRET,
    DOMAIN_API_AGENCY_ID,
    DOMAIN_API_ENV,
    DOMAIN_API_GRANT_TYPE,
} = process.env;

const AUTH_TOKEN_URL = "https://auth.domain.com.au/v1/connect/token";
const API_SCOPE = "openid offline_access api_listings_read api_listings_write api_agencies_read api_agencies_write";

function apiBase() {
    const env = (DOMAIN_API_ENV || "sandbox").toLowerCase();
    return env === "production"
      ? "https://api.domain.com.au/v1"
          : "https://api.domain.com.au/sandbox/v1";
}

function assertConfigured() {
    const missing = [];
    if (!DOMAIN_API_CLIENT_ID) missing.push("DOMAIN_API_CLIENT_ID");
    if (!DOMAIN_API_CLIENT_SECRET) missing.push("DOMAIN_API_CLIENT_SECRET");
    if (!DOMAIN_API_AGENCY_ID) missing.push("DOMAIN_API_AGENCY_ID");
    if (missing.length) {
          throw new Error(
                  "Domain Listing Management API not configured - missing env var(s): " +
                  missing.join(", ") +
                  ". These come from Domain once ticket #3032256 is finalised. See NEEDED_FROM_DOMAIN.md."
                );
    }
}

let cachedToken = null;

async function getAccessToken() {
    assertConfigured();
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
          return cachedToken.accessToken;
    }
    const grantType = DOMAIN_API_GRANT_TYPE || "client_credentials";
    const basicAuth = Buffer.from(DOMAIN_API_CLIENT_ID + ":" + DOMAIN_API_CLIENT_SECRET).toString("base64");
    const body = new URLSearchParams({ grant_type: grantType, scope: API_SCOPE });
    const res = await fetch(AUTH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + basicAuth },
          body: body.toString(),
    });
    if (!res.ok) {
          const text = await res.text().catch(function () { return ""; });
          throw new Error(
                  "Domain auth failed (" + res.status + "): " + (text || res.statusText) +
                  ". If this is a grant_type-not-supported error, Domain's issued client may require authorization_code instead."
                );
    }
    const json = await res.json();
    cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
    return cachedToken.accessToken;
}

const PROPERTY_TYPE_MAP = {
    House: "house", Apartment: "apartment", Unit: "unit", Townhouse: "townhouse",
    Villa: "villa", Land: "vacantLand", Rural: "acreage", Acreage: "acreage",
    Duplex: "duplex", Terrace: "terrace", Studio: "studio",
};

function splitStreet(fullAddress) {
    const m = String(fullAddress || "").trim().match(/^(\d+[A-Za-z]?(?:\/\d+)?)\s+(.*)$/);
    if (!m) return { streetNumber: "", street: String(fullAddress || "") };
    return { streetNumber: m[1], street: m[2] };
}

function buildContactFromAgent(listing) {
    const parts = (listing.agentName || "Alexander Bourne").split(" ");
    const firstName = parts[0];
    const rest = parts.slice(1);
    return [{
          firstName: firstName || "Alexander",
          lastName: rest.join(" ") || "Bourne",
          phone: listing.agentPhone || "0485043210",
          email: listing.agentEmail || "alexander@no-agents.com.au",
          receiveEmails: true,
    }];
}

function toDomainListingBody(listing) {
    const streetNumber = listing.streetNumber || splitStreet(listing.address).streetNumber;
    const street = listing.street || listing.streetName || splitStreet(listing.address).street;
    const priceNum = parseInt(String(listing.price || "").replace(/[^0-9]/g, ""), 10) || 0;

  const body = {
        listingAction: "sale",
        propertyDetails: {
                propertyType: [PROPERTY_TYPE_MAP[listing.type || listing.propertyType] || "house"],
                bedRooms: parseInt(listing.beds, 10) || 0,
                bathRooms: parseInt(listing.baths, 10) || 0,
                address: {
                          displayOption: "fullAddress",
                          state: (listing.state || "QLD").toLowerCase(),
                          streetNumber: streetNumber,
                          street: street,
                          suburb: listing.suburb || "",
                          postcode: listing.postcode || "",
                },
        },
        contacts: buildContactFromAgent(listing),
        domainAgencyID: Number(DOMAIN_API_AGENCY_ID),
        providerAdId: listing.id || listing.uniqueId,
        description: listing.description || "Contact agent for details.",
        summary: listing.headline || ((listing.beds || "") + " bed " + (listing.type || listing.propertyType || "property") + " - No Commission"),
        price: priceNum > 0 ? { from: priceNum, to: priceNum } : undefined,
  };

  if (listing.cars) {
        body.propertyDetails.carSpaces = parseInt(listing.cars, 10) || 0;
  }
    if (listing.landSize) {
          body.propertyDetails.area = { unit: "squareMetres", value: parseInt(listing.landSize, 10) || 0 };
    }
    if (Array.isArray(listing.inspectionTimes) && listing.inspectionTimes.length) {
          body.inspectionDetails = {
                  inspections: listing.inspectionTimes.map(function (t) { return { from: t, to: t }; }),
          };
    }

  // TODO PHOTOS: Domain's sample request body has no images/media field at
  // all. There is almost certainly a separate media/photos endpoint not
  // covered in the upload-listings guide. Do NOT wire this into production
  // until Domain confirms how photos/Matterport get attached - otherwise a
  // listing pushed through this code reaches Domain with zero photos.

  return body;
}

async function pushListingToDomain(listing) {
    assertConfigured();
    const token = await getAccessToken();
    const body = toDomainListingBody(listing);
    const res = await fetch(apiBase() + "/listings/residential", {
          method: "PUT",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify(body),
    });
    if (!res.ok) {
          const text = await res.text().catch(function () { return ""; });
          throw new Error("Domain listing push failed (" + res.status + "): " + (text || res.statusText));
    }
    return res.json();
}

async function getProcessingStatus(jobId) {
    assertConfigured();
    const token = await getAccessToken();
    const res = await fetch(apiBase() + "/listings/processingReports/" + encodeURIComponent(jobId), {
          headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
          const text = await res.text().catch(function () { return ""; });
          throw new Error("Domain processing-status check failed (" + res.status + "): " + (text || res.statusText));
    }
    return res.json();
}

async function pollUntilProcessed(jobId, options) {
    const maxAttempts = (options && options.maxAttempts) || 10;
    const delayMs = (options && options.delayMs) || 3000;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const report = await getProcessingStatus(jobId);
          if (report.processStatus === "processed") return report;
          if (report.processStatus === "failed" || report.processStatus === "error") {
                  throw new Error("Domain rejected the listing during processing: " + JSON.stringify(report));
          }
          await new Promise(function (r) { setTimeout(r, delayMs); });
    }
    throw new Error("Domain listing job " + jobId + " still not processed after " + maxAttempts + " attempts - check manually via processingReports.");
}

async function takeListingOffMarket(domainListingId, options) {
    assertConfigured();
    const action = (options && options.action) || "withDrawn";
    const comment = (options && options.comment) || "";
    const token = await getAccessToken();
    const res = await fetch(apiBase() + "/listings/" + encodeURIComponent(domainListingId) + "/offmarket", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ offMarketAction: action, actionDate: new Date().toISOString().slice(0, 10), comment: comment }),
    });
    if (!res.ok) {
          const text = await res.text().catch(function () { return ""; });
          throw new Error("Domain offmarket call failed (" + res.status + "): " + (text || res.statusText));
    }
    return res.json();
}

module.exports = {
    getAccessToken: getAccessToken,
    toDomainListingBody: toDomainListingBody,
    pushListingToDomain: pushListingToDomain,
    getProcessingStatus: getProcessingStatus,
    pollUntilProcessed: pollUntilProcessed,
    takeListingOffMarket: takeListingOffMarket,
};
