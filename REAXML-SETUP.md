# REAXML Feed — Setup Guide

## What was built

Two new serverless functions:

| File | URL | Purpose |
|------|-----|---------|
| `api/feed.js` | `https://no-agents.com.au/api/feed` | REAXML 1.0 feed — Domain/REA poll this |
| `api/listing-store.js` | `https://no-agents.com.au/api/listing-store` | Internal CRUD for listing data |

---

## Deploy steps

1. Copy `api/feed.js` and `api/listing-store.js` into your local `no-agents` repo
2. `git add api/feed.js api/listing-store.js && git commit -m "Add REAXML feed + listing store" && git push`
3. Vercel auto-deploys on push to `main`

---

## Vercel KV setup (one-time)

1. In [Vercel Dashboard](https://vercel.com/dashboard) → your `no-agents` project → **Storage** tab
2. Click **Create Database** → **KV (Upstash)**
3. Vercel will auto-add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project env vars

---

## New env vars to add

In Vercel project → **Settings → Environment Variables**:

```
LISTING_API_SECRET = <any strong random string — keep private>
```

This secret protects the listing-store endpoint. Your stripe webhook calls it with:
```
x-api-secret: <LISTING_API_SECRET>
```

---

## Wire up stripe-webhook.js

In your existing `api/stripe-webhook.js`, after confirming payment success, add:

```javascript
// After verifying Stripe event type === 'checkout.session.completed':
const session = event.data.object;
const meta = session.metadata || {}; // listing data passed via Stripe metadata

if (meta.listingData) {
  const listing = JSON.parse(meta.listingData);
  await fetch(`${process.env.VERCEL_URL}/api/listing-store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': process.env.LISTING_API_SECRET,
    },
    body: JSON.stringify(listing),
  });
}
```

And in `api/checkout.js`, pass the listing form data as Stripe metadata:

```javascript
// When creating the checkout session, include:
metadata: {
  listingData: JSON.stringify({
    address: body.address,
    suburb:  body.suburb,
    state:   body.state || 'QLD',
    postcode: body.postcode,
    type:    body.type,
    beds:    body.beds,
    baths:   body.baths,
    cars:    body.cars,
    price:   body.price,
    description: body.description,
    sellerName:  body.sellerName,
    sellerEmail: body.sellerEmail,
    sellerPhone: body.sellerPhone,
  }),
},
```

> **Note:** Stripe metadata values must be strings ≤ 500 chars. For long descriptions, truncate or store separately.

---

## Give Domain the feed URL

Tell Sally Chase at Domain:

> Feed URL: `https://no-agents.com.au/api/feed`  
> Format: REAXML 1.0  
> Poll frequency: daily (or as configured by Domain)

The feed returns a valid empty XML document until the first paid listing is received — so it is safe to configure now.

---

## Testing the feed

```bash
curl https://no-agents.com.au/api/feed
```

Expected response (empty feed):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<propertyList date="2026-06-10">

</propertyList>
```
