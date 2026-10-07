# Domain Listings Management API — integration status

## What's done

`domain-listing-client.js` is a complete, ready-to-deploy client for Domain's
Listing Management API, built against their public docs:
https://developer.domain.com.au/docs/latest/apis/pkg_listing_management/guides/upload-listings/

It replaces the two publishing paths that Domain has confirmed will never
work (ticket #3032256, Vin, Domain API Support, 29 Sept 2026):
- `api/feed.js` — self-hosted REAXML feed. Domain: "we no longer set up new
-   REAXML feed integrations... not able to poll your feed."
-   - `api/publish-listing.js` FTP branch — never had FTP credentials configured
    -   anyway, and Domain doesn't support FTP intake either.
 
    -   It is **not wired into the live pipeline yet** and **cannot go live yet** —
    -   see the checklist below.
 
    -   ## Still needed from Domain before this can go live
 
    -   1. **API credentials** — `DOMAIN_API_CLIENT_ID` and `DOMAIN_API_CLIENT_SECRET`.
        2.    These get created in Domain's developer portal (developer.domain.com.au)
        3.   once Domain grants the "Listing Management" package — which is what
        4.      ticket #3032256 is currently requesting. Per their own sandbox
        5.     walkthrough, you'd create these yourself once the package is assigned:
        6.    Projects → Create Project → Credentials → Create client.
        7.2. **Domain's internal agency ID** (`DOMAIN_API_AGENCY_ID`) — this is very
             likely a different number from the Skylight "Agency ID 40279" seen in the
             portal URL. Domain's own docs show agency ids as separate integers
             returned from their API (e.g. `"id": 32564` in their sandbox example).
             Ask Domain for No Agents' agency id in the same support thread.
          3. **Confirm the OAuth grant type.** The code defaults to `client_credentials`
          4.    (the standard approach for unattended server-to-server calls). Domain's
          5.   walkthrough only demos `authorization_code` (a human has to log in once),
          6.      which is harder to automate. If the client Domain issues doesn't support
          7.     `client_credentials`, flag it back to them — this needs resolving before
          8.    the cron-based auto-publish can run unattended.
          9.4. **Photo/media upload mechanism — the biggest open gap.** Domain's sample
               request body for creating a listing has no images field at all. There's
               presumably a separate endpoint or step for attaching photos (and the
               Matterport tour), but it isn't covered in the page I read. **Ask Domain
               directly: "how do we attach photos to a listing created via the Listing
               Management API?"** Do not flip the switch on this integration until
               that's answered — right now a listing pushed through this code would
               reach Domain with zero photos, which breaks the entire point of the
               photography gate already built into `mark-photos-ready.js`.
            5. **Sandbox access first.** Domain's own process says: build and test
               against their sandbox package before requesting the live/production
               package. Worth doing a full dry run (fake listing, fake agency) once
               sandbox credentials exist, before pointing this at the real feed of
               paying customers.

            ## How to wire it in once credentials exist

        Two call sites currently POST to `/api/publish-listing` (the dead FTP path).
        Both need the same two-line change — replace the `fetch('/api/publish-listing', ...)`
        block with a call into the new client:

        **In `api/mark-photos-ready.js`** (inside the `if (goesLiveNow) { ... }` block):

        ```javascript
        const { pushListingToDomain, pollUntilProcessed } = require('./domain-listing-client');
        // ...
        let publishResult = null;
        if (goesLiveNow) {
          try {
            const job = await pushListingToDomain(listing);
            const report = await pollUntilProcessed(job.id);
            listing.domainListingId = report.adId?.[0] || null; // save for offmarket later
            publishResult = report;
          } catch (e) {
            console.error('[mark-photos-ready] Domain push failed:', e.message);
            // keep the existing notifyAdmin() call below so a failure here isn't silent
          }
        }
        ```

        **In `api/cron-publish.js`** (inside the `for (const listing of listings)` loop,
        same pattern — replace the `fetch(`${base}/api/publish-listing`...)` block).

        Also worth adding: a call to `takeListingOffMarket()` wherever a listing is
        currently marked `sold` or `withdrawn` internally (haven't traced that code
        path yet — check `api/settle.js`, which looks like it may already handle
        settlement/sold status and would be the natural place to add this).

        ## One thing to double check once this is live

        `toDomainListingBody()` currently sources the listing's "contacts" entry
        from the agent (Alexander), not the seller — on the assumption that all
        Domain enquiries should route to the agency, matching how the business
        actually works. Worth a quick sanity check against a real test listing in
        Domain's sandbox before trusting it in production.
        
