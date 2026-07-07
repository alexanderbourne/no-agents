// api/guides.js
// Long-form informational content for long-tail, top-of-funnel search queries
// ("how to sell privately in Queensland") that the suburb pages don't target —
// people who aren't ready to search "sell my house Brisbane" yet. Same
// serverless-SSR pattern as api/suburb-page.js.
//
// /guides            -> hub page (all articles)
// /guides/:slug       -> article (rewritten here with ?slug=)

const SITE = 'https://www.no-agents.com.au';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',system-ui,sans-serif;background:#faf9f6;color:#1a1a1a;font-size:15.5px;line-height:1.7;-webkit-font-smoothing:antialiased}a{color:#a07828}.sf{font-family:'Playfair Display',Georgia,serif}.wrap{max-width:760px;margin:0 auto;padding:0 24px}nav{position:sticky;top:0;background:rgba(250,249,246,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e5e0d6;z-index:10}nav .wrap{max-width:860px;display:flex;align-items:center;justify-content:space-between;height:60px}.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;font-size:17px;color:#1a1a1a}.logo .na{width:34px;height:34px;border-radius:8px;background:#1a1a1a;color:#e8d5b0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}.cta{background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600}.hero{text-align:center;padding:56px 24px 40px}.badge{display:inline-block;background:#f5f0e8;border:1px solid #e5e0d6;color:#a07828;font-size:11.5px;font-weight:700;letter-spacing:.08em;padding:6px 14px;border-radius:999px;margin-bottom:20px;text-transform:uppercase}h1{font-size:clamp(28px,4.5vw,40px);line-height:1.15;font-weight:700;margin-bottom:14px}.sub{color:#4a4540;max-width:620px;margin:0 auto}section{padding:36px 0}article h2{font-size:22px;margin:32px 0 12px;font-weight:700}article h3{font-size:18px;margin:22px 0 8px;font-weight:600}article p{margin-bottom:14px;color:#2a2620}article ul,article ol{margin:0 0 14px 22px;color:#2a2620}article li{margin-bottom:6px}.callout{background:#fff;border:1px solid #e5e0d6;border-left:4px solid #1a1a1a;border-radius:8px;padding:16px 20px;margin:20px 0}.meta{color:#8a8078;font-size:13.5px;margin-bottom:28px}.card{background:#fff;border:1px solid #e5e0d6;border-radius:12px;padding:20px;margin-bottom:14px;text-decoration:none;display:block;color:inherit}.card h3{margin:0 0 6px}.card p{margin:0;color:#4a4540;font-size:14px}.cta-band{background:#1a1a1a;color:#fff;text-align:center;padding:48px 24px;margin-top:40px}.cta-band h2{color:#fff}.cta-band p{color:rgba(255,255,255,.7);margin-bottom:16px}.cta-band .cta{background:#e8d5b0;color:#1a1a1a;display:inline-block}footer{padding:36px 24px;text-align:center;font-size:13px;color:#8a8078}footer a{color:#8a8078;text-decoration:none;margin:0 8px}`;

const NAV = `<nav><div class="wrap"><a class="logo sf" href="/"><span class="na">na</span>no-agents</a><a class="cta" href="/sell">List for $798</a></div></nav>`;
const FOOTER = `<footer>© 2026 No Agents Pty Ltd · ABN 18 642 813 438 · Licence 4542501 QLD<br><a href="/">Home</a>·<a href="/sell">Sell</a>·<a href="/guides">Guides</a>·<a href="/qld-suburbs">All suburbs</a></footer>`;

function head(title, desc, path, ld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="no-agents">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}">
<meta name="geo.region" content="AU-QLD">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>${CSS}</style>
</head>`;
}

const GUIDES = [
  {
    slug: 'how-to-sell-your-house-privately-in-queensland',
    title: 'How to Sell Your House Privately in Queensland: A Complete Guide',
    desc: 'A step-by-step guide to selling your own home in Queensland without a real estate agent — legally, safely, and without paying commission.',
    published: '2026-06-15',
    summary: 'What FSBO actually involves in QLD, step by step — and where the process still needs a licensed agency behind it.',
    body: `
<p>Selling a house without a real estate agent — often called "for sale by owner" or FSBO — is completely legal in Queensland, provided the sale still runs through a licensed real estate agency for the parts of the process the law requires it for. Here's exactly how the process works, from the day you decide to sell to the day you hand over the keys.</p>

<h2>1. Get your property genuinely market-ready</h2>
<p>Before anything goes live, you need accurate details: address, land size, floor area, number of bedrooms/bathrooms/car spaces, and an honest description of condition and features. Buyers verify this against public records and their own inspection, so accuracy matters more than polish.</p>

<h2>2. List on a major portal, not just word of mouth</h2>
<p>The overwhelming majority of Queensland property buyers search on Domain.com.au or realestate.com.au before anywhere else. A private listing that only exists on a noticeboard or a Facebook group will structurally underperform one on a major portal — this is the single biggest reason FSBO sellers historically struggled, not the absence of an agent.</p>

<h2>3. Professional photography and a floor plan</h2>
<p>Listings with professional photography and a floor plan consistently attract more serious enquiries than phone-camera photos. A 3D virtual tour lets interstate or overseas buyers shortlist your property before booking an inspection, which matters more than ever given how much of the buyer search process now happens before a single physical inspection.</p>

<h2>4. Manage enquiries and inspections</h2>
<p>Every enquiry should be logged and followed up quickly — buyers moving through multiple listings will simply move on if a seller is slow to respond. For inspections, you can meet buyers yourself, or engage a licensed agent to attend on your behalf for a per-visit fee, which matters especially if you work standard business hours or the property is tenanted.</p>

<h2>5. Take and compare offers</h2>
<p>An offer is an expression of interest, not a binding contract. Compare offers on price, deposit, settlement timeframe, and any conditions (finance, building & pest) — a higher headline price with a shaky finance condition can be worth less than a lower, cleaner offer.</p>

<h2>6. The Heads of Agreement and the formal Contract of Sale</h2>
<p>Once you accept an offer, the agreed terms are typically documented first as a Heads of Agreement — a summary both parties sign to confirm the deal before the formal, legally binding Contract of Sale is prepared. The Contract of Sale itself must be prepared by a licensed conveyancer or solicitor; this step doesn't change whether you sold through an agent or privately.</p>

<h2>7. Conditions, cooling-off, and settlement</h2>
<p>Most residential contracts in Queensland include a statutory cooling-off period for the buyer, plus any negotiated conditions like finance approval or a building & pest inspection. Settlement — the day money and title actually change hands — typically follows 30 to 90 days after the contract becomes unconditional, depending on what was agreed.</p>

<h2>Why this still needs a licensed agency</h2>
<p>Queensland's Property Occupations Act 2014 regulates who can market and sell residential property for a fee — this is why "FSBO" platforms in Queensland operate as licensed real estate agencies themselves (charging a flat fee instead of a percentage commission), rather than being a way to bypass the licensing requirement entirely. The saving comes from the fee structure, not from skipping the legal framework.</p>

<div class="callout"><strong>The short version:</strong> the legal and process steps are identical to a traditional sale — what changes is who does the marketing legwork, and what you pay for it.</div>
`,
  },
  {
    slug: 'fsbo-vs-real-estate-agent-commission-cost',
    title: 'FSBO vs Real Estate Agent: What Commission Actually Costs You',
    desc: 'A real breakdown of what a traditional real estate agent commission costs on a Queensland home sale, and where that money actually goes.',
    published: '2026-06-18',
    summary: 'The actual maths behind agent commission on a Queensland sale, broken into what you’re paying for.',
    body: `
<p>Real estate commission in Queensland is typically charged as a percentage of the final sale price, commonly in the 2% to 3% range depending on the agency and region, plus GST. On top of that percentage, most agency agreements also pass through a separate marketing budget (often called a VPA — vendor-paid advertisement) and, for auction campaigns, an auctioneer's fee.</p>

<h2>Worked example</h2>
<p>Take a home selling for $720,000 at a 2.75% commission rate:</p>
<ul>
<li><strong>Commission:</strong> approximately $19,800</li>
<li><strong>Marketing/VPA:</strong> commonly $3,000&ndash;$8,000, charged regardless of whether the property sells</li>
<li><strong>Auctioneer's fee (if applicable):</strong> commonly $400&ndash;$800</li>
</ul>
<p>Total cost to the seller: often $23,000&ndash;$29,000 on a $720,000 sale — before GST is added to the commission component.</p>

<h2>What that fee is actually paying for</h2>
<p>Commission compensates an agency for marketing, negotiation, buyer qualification, inspection management, and administration through to settlement. None of that work disappears under a flat-fee model — it's simply priced differently: a fixed fee rather than a fee that scales with the sale price.</p>

<h2>Why percentage-based commission scales oddly</h2>
<p>The actual marketing and administrative work involved in selling a $500,000 unit and a $1.5 million house is broadly similar — the portal listing, the photography shoot, and the inspection process don't triple in effort because the price triples. A percentage fee means the price of the service scales with the property's value rather than with the actual work involved, which is the core argument for a flat-fee alternative.</p>

<h2>What a flat-fee model changes — and doesn't</h2>
<p>A flat-fee listing (commonly a few hundred to under $1,000, all-inclusive) still requires the property to be listed by a licensed agency, still runs through the same contract and conveyancing process, and still involves genuine marketing and buyer management. What changes is that the fee is fixed regardless of the sale price, so a seller of a $1.5 million property doesn't pay proportionally more for essentially the same service as a seller of a $500,000 property.</p>

<h2>Where the real trade-off is</h2>
<p>The honest trade-off with a flat-fee model isn't legal risk — it's that you (the seller) typically do more of the day-to-day coordination yourself, or pay per-visit for a licensed agent to attend inspections, rather than having one person manage the entire campaign end-to-end by default. For sellers comfortable with some hands-on involvement, that trade clearly favours the flat fee. For sellers who want to be fully hands-off from day one, it's a genuine consideration.</p>

<div class="callout">Use a commission calculator against your own suburb's median price before assuming either model is automatically cheaper for your situation — the gap widens significantly at higher price points.</div>
`,
  },
  {
    slug: 'building-and-pest-inspections-selling-without-an-agent',
    title: 'Building & Pest Inspections When Selling Without an Agent',
    desc: 'How building and pest inspection conditions work in a Queensland property sale, and what sellers need to know when managing the process themselves.',
    published: '2026-06-22',
    summary: 'What a B&P condition actually means for a seller, and how the clearance process typically runs.',
    body: `
<p>A building and pest (B&amp;P) inspection condition is one of the most common conditions attached to a residential offer in Queensland. Understanding how it works matters whether you're selling with an agent or managing the process yourself.</p>

<h2>What a B&P condition actually is</h2>
<p>When a buyer submits an offer "subject to building and pest," they're asking for a window of time (commonly 7&ndash;14 days from contract signing) to have a licensed inspector assess the property's structural condition and check for termite or pest activity, before their purchase becomes unconditional. If the report reveals a significant issue, the buyer typically has the right to negotiate a price reduction, request repairs, or in some cases withdraw from the contract.</p>

<h2>Who arranges the inspection</h2>
<p>The buyer engages and pays for the building and pest inspector — this is standard regardless of whether the seller used an agent or sold privately. The seller's role is to provide reasonable access to the property for the inspection to take place within the agreed condition period.</p>

<h2>What sellers should do before listing</h2>
<p>Some sellers choose to commission their own pre-sale building and pest report before the property even goes to market. This can surface issues early (so they can be disclosed or addressed upfront) and can reduce the chance of a buyer's report derailing negotiations late in the process — though it isn't a legal requirement.</p>

<h2>Managing access without an agent</h2>
<p>If you're managing your own inspections, coordinate directly with the buyer's inspector on timing, and be upfront about property access (keys, alarm codes, pets). Sellers using a licensed inspection-panel agent for buyer walkthroughs can extend the same arrangement to a B&amp;P inspector's visit if they'd rather not attend in person themselves.</p>

<h2>If the report raises an issue</h2>
<p>Most B&amp;P conditions give the buyer a defined window to raise concerns in writing. From there, it's a negotiation like any other — a price adjustment, an agreed repair, or in some cases the buyer exercising their right to terminate under the condition. None of this requires a real estate agent to facilitate; it's a conversation between seller and buyer (often via their respective conveyancers once the matter is more than a minor adjustment).</p>

<h2>Finding a licensed inspector</h2>
<p>Building and pest inspectors must be licensed in Queensland. A quick search for licensed inspectors in your specific suburb, sorted by review rating, is generally the most transparent way to find a reputable local operator — rather than relying on a single recommended provider who may not actually service your area.</p>

<div class="callout">The B&P condition period is usually the tightest deadline in the whole transaction — track it closely, since missing it can affect either party's rights under the contract.</div>
`,
  },
  {
    slug: 'heads-of-agreement-explained-queensland',
    title: 'What Is a Heads of Agreement? The QLD Property Contract Process Explained',
    desc: 'Understanding the Heads of Agreement stage of a Queensland property sale, how it differs from the formal Contract of Sale, and what happens next.',
    published: '2026-06-25',
    summary: 'How the Heads of Agreement stage fits between an accepted offer and the binding Contract of Sale.',
    body: `
<p>Once a seller accepts a buyer's offer on a Queensland property, there's a step that often causes confusion: the Heads of Agreement. It isn't the final contract, but it isn't nothing either — here's exactly what it is and how it fits into the process.</p>

<h2>What a Heads of Agreement actually is</h2>
<p>A Heads of Agreement is a written summary of the terms both parties have agreed to — purchase price, deposit, settlement period, and any conditions like finance or building &amp; pest — signed by buyer and seller to confirm the deal before the formal Contract of Sale is drawn up. Think of it as documenting "we agree on these terms," rather than the legally binding sale document itself.</p>

<h2>Why it exists as a separate step</h2>
<p>The formal Contract of Sale is a detailed legal document that a licensed conveyancer or solicitor prepares, incorporating standard clauses, title details, and any special conditions correctly drafted in enforceable legal language. That takes time to prepare properly. The Heads of Agreement lets both parties lock in the commercial terms immediately — so the deal doesn't fall through while the formal paperwork catches up — without either side needing to wait on a solicitor before confirming they're both genuinely committed.</p>

<h2>Signing order matters</h2>
<p>Typically the buyer signs first, then the seller countersigns once the buyer's signature is confirmed. This sequencing protects the seller from countersigning (and effectively taking the property off the market) before knowing the buyer has actually committed.</p>

<h2>What happens once both parties have signed</h2>
<p>Once both signatures are in place, the matter is handed to a conveyancer or solicitor to prepare the formal, legally binding Contract of Sale based on the agreed terms. This is also typically the point at which any nominated conveyancer is formally engaged and briefed on the transaction.</p>

<h2>Is the Heads of Agreement legally binding?</h2>
<p>It documents an agreement in principle, but the parties' full legal rights and obligations are set out in the formal Contract of Sale once it's executed — including the buyer's statutory cooling-off rights, which apply to the formal contract. Treat the Heads of Agreement as a serious commitment, not as something either party can walk away from casually, but understand that the detailed legal mechanics live in the contract that follows.</p>

<h2>What sellers should check before signing</h2>
<p>Before countersigning, check that every commercial term matches what you actually agreed to verbally or in negotiation — price, deposit amount and timing, settlement date, and every condition (finance days, building &amp; pest days, any special conditions). Errors are far easier to fix at this stage than after the formal contract is drawn up.</p>

<div class="callout">If you haven't nominated your own conveyancer by this stage, this is the point in the process where one needs to be engaged — don't leave it until the contract is due to be signed.</div>
`,
  },
  {
    slug: 'cooling-off-periods-queensland-property-sales',
    title: 'Cooling-Off Periods in Queensland Property Sales: What Buyers and Sellers Need to Know',
    desc: 'How the statutory cooling-off period works for residential property sales in Queensland, what it protects, and how it can be waived.',
    published: '2026-06-28',
    summary: 'The buyer’s statutory right to walk away from a signed contract, and what it actually costs them to do so.',
    body: `
<p>Queensland gives residential property buyers a statutory cooling-off period after signing a Contract of Sale — a safety net that exists regardless of whether the seller used a traditional agent or sold privately.</p>

<h2>What the cooling-off period actually is</h2>
<p>Once a buyer signs the formal Contract of Sale, they typically have a short window — commonly around five business days — during which they can terminate the contract without having to prove any reason. This protects buyers who may have signed under time pressure (for example, in a competitive multi-offer situation) from being locked into a purchase they haven't had time to fully consider.</p>

<h2>It isn't free to exercise</h2>
<p>Terminating during the cooling-off period isn't cost-free for the buyer — they typically forfeit a small percentage of the purchase price (commonly a quarter of one percent) to the seller as a termination penalty. This is deliberately set low enough to make the right meaningful, but high enough to discourage buyers from using it casually.</p>

<h2>When cooling-off doesn't apply</h2>
<p>The cooling-off period generally doesn't apply to properties bought at auction, or where the buyer has waived the right (commonly via a solicitor's certificate confirming they've received independent legal advice on the waiver). It's also distinct from any negotiated conditions in the contract itself, like finance or building &amp; pest — those operate on their own separate timeframes and don't require any penalty to invoke if the condition genuinely isn't met.</p>

<h2>What this means for sellers</h2>
<p>As a seller, the cooling-off period means a signed contract isn't fully secure until the window closes. It's rarely used in practice — most buyers who've made it to a signed contract intend to proceed — but it's worth understanding rather than being caught off guard if a buyer does exercise it. It's also a reason not to make firm commitments (like booking removalists or giving notice on your own next purchase) until the cooling-off window has passed.</p>

<h2>How it interacts with the Heads of Agreement stage</h2>
<p>The cooling-off period applies to the formal, executed Contract of Sale — not to a Heads of Agreement or offer acceptance, which are earlier, less formal stages of the process. Don't assume cooling-off protections apply before the actual contract is signed; the legal position at those earlier stages is different.</p>

<div class="callout">If a buyer does invoke cooling-off, the termination penalty is typically handled by the conveyancers on both sides as part of settling accounts — it isn't something either party needs to chase manually.</div>
`,
  },
  {
    slug: 'how-open-offer-boards-work',
    title: 'How Open Offer Boards Work: Selling With Full Price Transparency',
    desc: 'How a transparent, open offer board compares to traditional private negotiation when selling a property, and what it means for both buyers and sellers.',
    published: '2026-07-01',
    summary: 'Why an open offer board removes gazumping and blind bidding from the sale process.',
    body: `
<p>Most traditional property sales run on private negotiation — a buyer submits an offer to the agent, the agent negotiates on the seller's behalf, and other interested buyers have no visibility into what's actually been offered. An open offer board works differently, and it's worth understanding both models before you sell or buy.</p>

<h2>How private negotiation typically works</h2>
<p>In a traditional sale, offers are submitted privately to the seller's agent. Other buyers generally can't see competing offers, which means they're negotiating somewhat blind — they don't know if their offer is genuinely competitive or being used as leverage against another buyer. This can lead to "gazumping," where a seller accepts a verbal offer and then takes a better one before contracts are signed, or to buyers overpaying because they assume (correctly or not) that they're up against stronger competition than actually exists.</p>

<h2>What an open offer board changes</h2>
<p>On an open offer board, every verified offer is visible to every verified buyer in real time — amount, settlement terms, and key conditions. Instead of negotiating through an intermediary who represents only the seller, buyers can see exactly where they stand against genuine competing interest, and adjust their own offer accordingly.</p>

<h2>Why transparency tends to produce genuine best offers</h2>
<p>When buyers can see real competing offers rather than being told a property has "strong interest" without evidence, they're negotiating against verified information instead of a sales narrative. This tends to produce offers that reflect what buyers actually believe the property is worth, rather than offers inflated or deflated by uncertainty about the competition.</p>

<h2>What "verified" actually means</h2>
<p>An offer being visible on an open board only works if it's genuinely from a real, identity-verified buyer — otherwise the transparency is meaningless. That's why buyer identity verification (typically a driver's licence or passport check) happens before a buyer can submit an offer, protecting sellers from fake or unserious offers cluttering the board.</p>

<h2>Does the seller have to accept the highest offer?</h2>
<p>No — an open offer board shows the terms, but the seller still chooses which offer to accept based on the full picture: price, deposit, settlement timeframe, and conditions like finance or building &amp; pest. A slightly lower offer with no finance condition and a fast, clean settlement can be a better outcome than a higher offer that's shakier.</p>

<div class="callout">Offers submitted through an open board are expressions of interest, not binding contracts — the legally binding step is still the formal Contract of Sale, prepared once an offer is accepted.</div>
`,
  },
  {
    slug: 'do-you-need-a-real-estate-licence-to-sell-your-own-home-queensland',
    title: 'Do You Need a Real Estate Licence to Sell Your Own Home in Queensland?',
    desc: 'A clear answer to whether Queensland homeowners need a real estate licence to sell their own property privately, and where the law actually applies.',
    published: '2026-07-03',
    summary: 'The straightforward answer to a question every first-time private seller asks.',
    body: `
<p>This is one of the first questions anyone considering a private sale in Queensland asks — and the honest answer is more nuanced than a flat yes or no.</p>

<h2>The short answer</h2>
<p>You do not need a real estate licence to sell your own home. Queensland's Property Occupations Act 2014 regulates people and businesses who sell property <em>on behalf of someone else</em> for a fee — it doesn't require an owner to be licensed to sell something they own themselves.</p>

<h2>So why do "sell without an agent" platforms mention a licence at all?</h2>
<p>Because most flat-fee "FSBO" platforms in Queensland — including this one — aren't actually a loophole around the licensing requirement. They operate <em>as</em> a licensed real estate agency, charging a flat fee instead of a percentage commission for the services they provide: listing publication on major portals, marketing, and coordination through to contract. The licence belongs to the platform/agency facilitating the sale, not to the individual homeowner.</p>

<h2>What genuinely unlicensed private selling looks like</h2>
<p>A homeowner can, in theory, market their own property entirely independently — a sign on the lawn, word of mouth, a listing on a general classifieds site — without any licensing requirement at all, provided no one is being paid a fee to act as their agent. In practice this severely limits reach, since the major property portals (which is where the large majority of serious buyers actually search) generally only accept listings from licensed agencies, not individual private sellers directly.</p>

<h2>Where the contract and settlement process still needs licensed professionals</h2>
<p>Regardless of how a property is marketed, the formal Contract of Sale must be prepared by a licensed conveyancer or solicitor, and settlement is handled through licensed conveyancing — this part of the process is identical whether you sold with a full-commission agent, a flat-fee agency, or entirely independently.</p>

<h2>The practical takeaway</h2>
<p>If your goal is a genuinely private sale with no fee to anyone, you can do that — but you'll be marketing outside the major portals, which most sellers find limits buyer reach too much to be worthwhile. If your goal is to avoid commission while still reaching serious buyers on Domain.com.au or realestate.com.au, that requires a licensed agency operating on a different fee model — which is what a flat-fee platform actually is.</p>

<div class="callout">Always check that a "no agent" platform discloses its real estate licence number — a legitimate flat-fee agency will display this prominently, since it's a legal requirement, not an optional trust signal.</div>
`,
  },
  {
    slug: 'settlement-day-what-happens-property-sale',
    title: 'Settlement Day: What Actually Happens When Your Property Sale Settles',
    desc: 'A plain-English walkthrough of what happens on settlement day for a Queensland property sale, from a seller’s perspective.',
    published: '2026-07-04',
    summary: 'What actually happens behind the scenes between an unconditional contract and handing over the keys.',
    body: `
<p>Settlement is the final step of a property sale — the day ownership and money actually change hands — but a lot happens in the lead-up that sellers don't always see directly, since most of it is handled by conveyancers.</p>

<h2>What "settlement" actually means</h2>
<p>Settlement is the point at which the buyer pays the remaining purchase price, the seller transfers legal title, and the buyer takes possession of the property. Everything before this — signing the contract, satisfying conditions like finance and building &amp; pest — is preparation for this single event.</p>

<h2>The lead-up: your conveyancer's role</h2>
<p>In the weeks before settlement, your conveyancer handles the mechanics most sellers never see directly: preparing the settlement statement (adjusting rates, water, and other outgoings between buyer and seller), liaising with the buyer's conveyancer, and coordinating with any mortgage lenders involved on either side.</p>

<h2>What happens on the day itself</h2>
<p>On settlement day, the respective conveyancers (and, if applicable, banks releasing or receiving mortgage funds) exchange the settlement funds and title documents — this typically happens electronically now via PEXA (Property Exchange Australia) rather than an in-person meeting. Once your conveyancer confirms funds have been received, you're cleared to hand over keys.</p>

<h2>When do you actually get paid?</h2>
<p>Sale proceeds are typically available shortly after settlement is confirmed on the day — your conveyancer will tell you once funds have actually cleared, since keys and possession shouldn't be handed over before that confirmation.</p>

<h2>What sellers need to have ready</h2>
<p>Before settlement, make sure all keys, remotes, security codes, and any items included in the sale (fixtures agreed to stay) are ready to hand over. If the property is tenanted, any handover of tenancy documentation to the buyer needs to be arranged in line with the contract terms and the buyer's own plans for the tenancy.</p>

<h2>What if something isn't ready on the day?</h2>
<p>Delays do happen — a lender's funds aren't released on time, or a document issue surfaces late. Your conveyancer manages this; it's rarely something a seller needs to resolve directly, though it can push settlement back by hours or occasionally days.</p>

<div class="callout">Don't book removalists, hand in notice at a new job, or make other firm commitments tied to your exact settlement date until your conveyancer confirms it's genuinely locked in — dates can shift even late in the process.</div>
`,
  },
  {
    slug: 'how-to-price-your-property-selling-without-an-agent',
    title: 'How to Price Your Property When Selling Without an Agent',
    desc: 'A practical approach to setting an asking price for your Queensland property when you’re selling privately, without an agent’s appraisal.',
    published: '2026-07-05',
    summary: 'How to arrive at a realistic price guide using the same data sources agents actually rely on.',
    body: `
<p>One of the genuine challenges of selling without an agent is pricing — a traditional agent brings a professional appraisal based on comparable sales they've personally handled. Here's how to arrive at a realistic price without that.</p>

<h2>Start with recent comparable sales, not listing prices</h2>
<p>Other properties' <em>asking</em> prices tell you what sellers hoped for, not what buyers actually paid. Recent <em>sold</em> prices for genuinely comparable properties (similar size, condition, and location) are a far more reliable guide. Domain and realestate.com.au both publish sold-price data and price estimate tools that give a reasonable starting range.</p>

<h2>Adjust for what the data can't see</h2>
<p>Automated price estimates work from data like land size, floor area, and recent nearby sales, but they can't see condition, renovations, or specific features. A recently renovated kitchen or a north-facing outlook can move a property meaningfully above a generic estimate — and a property needing significant work should be priced below one.</p>

<h2>Understand the difference between price guide and reserve</h2>
<p>Your advertised price guide is a marketing figure meant to attract genuine enquiry — it doesn't have to be a rigid number if you're running an open offer process, since the actual sale price gets tested by real offers rather than fixed at listing. Pricing too high suppresses enquiry volume; pricing too low can undersell the property if you're not running a genuinely competitive process to capture upside.</p>

<h2>Watch for the trap of overpricing</h2>
<p>Overpricing is the single most common private-seller pricing mistake. An overpriced listing gets less enquiry, sits longer on the market, and can develop a reputation among buyers watching the portals as "stale" — which then makes it harder to achieve a good price even after a later reduction. A realistic price from day one generally outperforms starting high and hoping.</p>

<h2>Use the transparency of an open offer board to your advantage</h2>
<p>If your platform runs an open offer board, you don't need to get the price guide perfect — genuine competing offers will reveal the market's actual view of value, often more accurately than any single appraisal could. This is one of the practical advantages of transparent bidding over a fixed asking price you're locked into.</p>

<div class="callout">If in doubt, price slightly conservatively and let competition do the work — a listing that attracts five genuine offers at your price guide almost always outperforms one that attracts none above an optimistic one.</div>
`,
  },
  {
    slug: 'selling-a-tenanted-property-queensland',
    title: 'Tenanted Property Sales: Selling a Rental Property in Queensland',
    desc: 'What Queensland landlords need to know about selling a property with tenants in place, including entry notice requirements and buyer considerations.',
    published: '2026-07-06',
    summary: 'What changes about the sale process when your property has tenants living in it.',
    body: `
<p>Selling a rental property with tenants still living in it involves a few extra considerations beyond a standard owner-occupied sale — mostly around access and the tenants' existing rights.</p>

<h2>Tenants' rights don't disappear because you're selling</h2>
<p>A valid residential tenancy agreement continues regardless of a change in ownership — a new owner buying a tenanted property generally takes on the tenancy as-is, for the remainder of its term. This is an important fact for both you and prospective buyers to understand upfront.</p>

<h2>Entry notice requirements for inspections</h2>
<p>Tenants are entitled to proper notice before their home is entered for marketing photography, inspections, or open homes — you can't simply let buyers through with no warning. The specific notice period is set by Queensland tenancy law, and getting this wrong can create real friction with tenants during a sale, which is the opposite of what you want during a marketing campaign.</p>

<h2>Keeping tenants informed and cooperative</h2>
<p>A tenant who feels ambushed by a sale process is far less likely to keep the property presentable for inspections or to be flexible about timing. Informing tenants early, being reasonable about scheduling, and — where appropriate — offering a small goodwill gesture for cooperation during the campaign tends to produce a smoother process and a better-presented property for buyers.</p>

<h2>Selling to an owner-occupier vs. another investor</h2>
<p>If your buyer intends to move in themselves rather than continue renting the property out, the existing tenancy and its notice-to-vacate timeline becomes a genuine negotiating point — buyers with a firm move-in timeline will want clarity on when they can actually take possession, which may not align neatly with your settlement date if a fixed-term tenancy is still running.</p>

<h2>What information buyers will want</h2>
<p>Prospective buyers of a tenanted property will typically want to see the current lease terms, rent amount, bond details, and the tenant's payment history — this is standard due diligence for anyone buying an investment property, and having it ready to share speeds up the process considerably.</p>

<h2>Coordinating access without an agent managing it day-to-day</h2>
<p>If you're managing the sale yourself rather than through a property manager, you're responsible for coordinating entry notices and inspection access directly with the tenant — or via a licensed agent attending on your behalf, if you'd rather not manage that relationship personally during the sale.</p>

<div class="callout">Start the tenant conversation before your listing goes live, not after the first inspection request comes in — it gives everyone more room to work with scheduling.</div>
`,
  },
  {
    slug: 'conveyancing-costs-queensland',
    title: 'Conveyancing Costs in Queensland: What You Pay and What You Get',
    desc: 'What conveyancing actually costs in Queensland, what the fee covers, and why every property sale — with or without an agent — runs through a conveyancer.',
    published: '2026-07-07',
    summary: 'The one professional every QLD sale needs, what they do, and the realistic cost ranges.',
    body: `
<p>Whether you sell through a traditional agent or a flat-fee platform, one professional is non-negotiable in a Queensland property sale: the conveyancer (or property solicitor). They handle the legal transfer of ownership — and their fee is one of the few genuinely unavoidable costs of a sale.</p>

<h2>What a conveyancer actually does</h2>
<p>For a seller, the conveyancer prepares the Contract of Sale, manages the disclosure documents the law requires, coordinates with the buyer's side through the conditional period (finance, building and pest), handles the discharge of your mortgage with your lender, and attends settlement — the moment ownership and money legally change hands. For a buyer, they review the contract, order title and property searches, and make sure what you're buying is what's actually on the title.</p>

<h2>What it typically costs</h2>
<p>Queensland conveyancing is usually quoted as a fixed professional fee plus disbursements — the third-party search and registration costs paid on your behalf. Professional fees commonly sit in the several-hundred-to-low-four-figure range, and disbursements add a few hundred dollars more depending on how many searches your transaction needs. Always ask for a fixed-fee quote that itemises disbursements separately, so there are no surprises at settlement.</p>

<h2>Solicitor vs conveyancer in Queensland</h2>
<p>In Queensland, conveyancing work is carried out by law firms — so your "conveyancer" is typically a solicitor or a conveyancing clerk working under one. This differs from some other states where standalone licensed conveyancers operate independently. Practically, it means QLD sellers get legal oversight built into the process by default.</p>

<h2>Why selling without an agent doesn't change any of this</h2>
<p>An agent never does the conveyancing — even in a full-commission sale, the contract and settlement always run through your conveyancer. Selling with a flat-fee platform uses exactly the same legal machinery: you save the commission, not the conveyancing. Budget for it in every scenario.</p>

<div class="callout">Engage your conveyancer before you list, not after you accept an offer — having the contract framework ready means an accepted offer can move to a signed contract in days rather than weeks.</div>
`,
  },
  {
    slug: 'stamp-duty-transfer-duty-queensland-explained',
    title: 'Stamp Duty (Transfer Duty) in Queensland Explained',
    desc: 'How Queensland transfer duty works when buying property, who pays it, when it is paid, and where concessions for home buyers and first home buyers fit in.',
    published: '2026-07-07',
    summary: 'Who pays it, how it scales with price, and the concessions that can dramatically reduce it.',
    body: `
<p>Transfer duty — still universally called stamp duty — is usually the single biggest transaction cost in a Queensland property purchase, often dwarfing every other fee combined. Here's how it works in plain English.</p>

<h2>Who pays, and when</h2>
<p>The buyer pays transfer duty, not the seller. It's assessed on the contract and must be paid before the transfer can be registered — in practice your conveyancer arranges payment as part of the settlement process, and you'll need the funds available on top of your deposit and purchase price.</p>

<h2>How the amount is calculated</h2>
<p>Duty is calculated on a sliding scale: the higher the purchase price, the higher the rate applied to each band of value. On a typical Brisbane house it commonly runs to tens of thousands of dollars at the standard rate — which is why the concessions matter so much.</p>

<h2>The home concession</h2>
<p>If you're buying a home you'll actually live in (rather than an investment), Queensland applies a concessional rate that can cut the bill substantially compared with the investor rate. There are occupancy requirements — move in within a set period and live there for a minimum time — and breaching them can claw the concession back.</p>

<h2>First home buyer concessions</h2>
<p>First home buyers get further relief again, potentially paying no duty at all below certain price thresholds, with the concession phasing out above them. The thresholds and rules have changed several times in recent years — check the Queensland Revenue Office's current figures before you budget, because outdated numbers circulate constantly online.</p>

<h2>What sellers should know</h2>
<p>Even though sellers don't pay duty, it shapes your buyer pool: price points just under a concession threshold attract noticeably more first-home-buyer demand. If your property sits near one, that's worth knowing when you set your price guide.</p>

<div class="callout">This is general information, not financial or legal advice — duty rates, thresholds and concessions change. Confirm current figures with the Queensland Revenue Office or your conveyancer before committing.</div>
`,
  },
  {
    slug: 'what-does-a-buyers-agent-do',
    title: "What Does a Buyer's Agent Do — and Do You Actually Need One?",
    desc: "What buyer's agents charge, what they actually deliver in a Queensland purchase, and when paying one makes sense versus doing it yourself.",
    published: '2026-07-07',
    summary: "The buyer-side equivalent of a selling agent: what they cost, and when they're worth it.",
    body: `
<p>A buyer's agent is the mirror image of a selling agent: a licensed professional who works exclusively for the purchaser — searching, appraising, negotiating and bidding on their behalf. They've grown rapidly in Australia as buyers look for an edge in competitive markets.</p>

<h2>What they actually do</h2>
<p>A full-service buyer's agent takes your brief, shortlists properties (including some sold off-market), inspects on your behalf, prepares price appraisals so you don't overpay, negotiates directly with the selling agent or seller, and bids for you at auction. A cheaper "negotiation only" engagement skips the search and just handles the deal on a property you've already found.</p>

<h2>What they cost</h2>
<p>Fees are typically either a fixed amount or a percentage of the purchase price — commonly in the one-to-three per cent range for full service. On a million-dollar purchase that's a five-figure fee, which is why the value question matters: they need to save you more than they cost, in price or in avoided mistakes.</p>

<h2>When one makes sense</h2>
<p>Buyer's agents earn their fee most clearly for interstate or overseas buyers who can't inspect personally, time-poor professionals, and buyers targeting tightly-held areas where off-market access matters. For a local buyer with time to research, much of what they provide — sales data, inspection legwork, pricing discipline — is achievable yourself.</p>

<h2>How transparent offer processes change the equation</h2>
<p>Part of a buyer's agent's traditional value is piercing the information fog of private negotiations — knowing what other offers really exist. On an open offer board, every verified offer is already visible to every buyer, which removes the blind-bidding problem the agent was partly hired to solve. You still might value their appraisal and negotiation experience; you just aren't paying to see through a wall that no longer exists.</p>

<div class="callout">If you do engage one, confirm they hold a real estate licence, work exclusively for buyers (no selling-side kickbacks), and put their fee structure in writing before you sign.</div>
`,
  },
  {
    slug: 'first-home-buyer-queensland-what-help-exists',
    title: 'First Home Buyers in Queensland: What Help Actually Exists',
    desc: 'A plain-English overview of the concessions, grants and guarantee schemes available to Queensland first home buyers, and where to verify the current rules.',
    published: '2026-07-07',
    summary: 'Duty concessions, grants and guarantee schemes — what each one does and where they apply.',
    body: `
<p>First home buyers in Queensland have several distinct forms of help available, and they're often confused with each other. Here's what each one actually is.</p>

<h2>Transfer duty concessions</h2>
<p>The biggest saving for most first home buyers is the transfer duty concession — reduced or zero stamp duty below certain price thresholds, phasing out above them. Because this scales with your purchase price, it can be worth tens of thousands of dollars, and it applies to established homes as well as new ones within the rules.</p>

<h2>The First Home Owner Grant</h2>
<p>The grant is a cash payment for first home buyers building or buying a brand-new home — it has never applied to established properties. The amount and eligibility criteria are set by the Queensland Government and have changed over time, so verify the current figure before you count on it.</p>

<h2>Home guarantee schemes</h2>
<p>Separately from the state measures, Commonwealth guarantee schemes allow eligible first home buyers to purchase with a small deposit without paying lenders mortgage insurance — the government guarantees part of the loan instead. Places, price caps and eligibility rules are set federally and administered through participating lenders.</p>

<h2>How the pieces stack</h2>
<p>These measures can often be combined: a duty concession plus a guarantee scheme place, for example. The practical effect is that a first home buyer's real budget can be meaningfully higher than their savings alone suggest — which is also worth understanding as a <em>seller</em>, because entry-level properties priced within concession thresholds see deeper buyer pools.</p>

<h2>Where to verify the current rules</h2>
<p>Every figure in this space — thresholds, grant amounts, scheme places — changes with budgets and policy cycles. Treat any specific number you read online (including here) as a prompt to check the Queensland Revenue Office and Housing Australia's current published rules, or ask your conveyancer or broker to confirm what applies to you.</p>

<div class="callout">General information only — eligibility rules change and depend on your circumstances. Confirm current thresholds with the QRO and your lender before making offers.</div>
`,
  },
  {
    slug: 'valuation-vs-appraisal-vs-avm-whats-the-difference',
    title: "Valuation vs Appraisal vs AVM: What's the Difference?",
    desc: 'Bank valuations, agent appraisals and automated valuation models all put a number on your property — but they mean very different things. Here is how each works.',
    published: '2026-07-07',
    summary: 'Three very different numbers get called "the value of your house" — here is what each one really is.',
    body: `
<p>Three different processes all produce "what your property is worth", and confusing them causes real problems — like planning a sale around a number no bank will lend against. Here's the distinction.</p>

<h2>A bank valuation is a formal, liability-backed opinion</h2>
<p>When a lender orders a valuation, a certified valuer inspects the property and produces a formal report the bank relies on to size its loan. Valuers carry professional liability for the number, which makes bank valuations conservative by design — they're protecting the lender's downside, not cheering your upside. This is the number that decides how much a buyer can actually borrow against your property.</p>

<h2>An agent appraisal is a marketing opinion</h2>
<p>A real estate agent's appraisal is an informed estimate based on comparable sales — but it's produced by someone hoping to win your listing. Overquoting to flatter a seller into signing an agency agreement, then "conditioning" them down during the campaign, is one of the industry's oldest patterns. Treat any appraisal that lands well above the data as a sales pitch, not a price.</p>

<h2>An AVM is a statistical estimate</h2>
<p>Automated valuation models — the instant estimates on portals and bank apps — crunch sales data, land size and property attributes to produce a value range in seconds. They're excellent for orientation and trend-tracking, weaker on properties with unusual features the model can't see (a renovation, a view, a flood overlay). Their confidence range matters as much as the midpoint.</p>

<h2>Using all three when you sell</h2>
<p>The practical approach: start with AVMs from a couple of sources for an unbiased baseline, sanity-check against actual recent sales you can verify, and treat any single much-higher opinion with suspicion. Then let real buyer competition — genuine offers — settle the question. The market's collective bid is the only "valuation" that ends in money.</p>

<div class="callout">If a buyer's bank valuation comes in under your agreed price, their finance clause is usually what saves them — and what puts the deal back on your table. Price realistically and this rarely happens.</div>
`,
  },
  {
    slug: 'making-an-offer-on-a-house-queensland-conditions-explained',
    title: 'Making an Offer on a House in Queensland: Conditions Explained',
    desc: 'What actually goes into a Queensland property offer — price, deposit, settlement period, finance and building & pest conditions — and how conditions change your bargaining position.',
    published: '2026-07-07',
    summary: 'Price is only one part of an offer — conditions decide how strong it really is.',
    body: `
<p>An offer on a Queensland property is more than a number. Sellers weigh the whole package — price, deposit, settlement timing and conditions — and a slightly lower unconditional offer regularly beats a higher, heavily-conditional one. Here's what each component does.</p>

<h2>Price, deposit and settlement period</h2>
<p>The deposit signals commitment — larger and earlier is stronger. The settlement period is the time between signed contract and the day money and title change hands; sellers often value a settlement date that matches their plans more than an extra few thousand dollars in price. If you can be flexible on timing, say so in the offer.</p>

<h2>The finance condition</h2>
<p>"Subject to finance" gives the buyer a set number of days to obtain formal loan approval, with the right to walk away if it falls through. It's the most common condition and a sensible protection — but every extra day of finance condition is uncertainty the seller carries. Buyers with strong pre-approval can shorten it; cash buyers who waive it entirely make their offer dramatically more attractive.</p>

<h2>The building and pest condition</h2>
<p>This lets the buyer commission a professional inspection and withdraw (or renegotiate) if significant defects surface. Sensible buyers include it; smart sellers pre-empt it by fixing known issues or disclosing upfront, because a mid-contract renegotiation almost always costs more than the repair would have.</p>

<h2>Subject to sale — the weakest common condition</h2>
<p>An offer conditional on the buyer selling their own property first pushes all the timing risk onto the seller, and is usually the first offer culled from a competitive field. If you must offer subject to sale, expect to pay a premium or accept being treated as a fallback.</p>

<h2>How this plays on an open offer board</h2>
<p>On a transparent offer board, conditions are visible alongside price — a $820,000 offer with no conditions sits honestly against an $835,000 offer with 21-day finance and B&P, and the seller weighs them openly. Buyers quickly learn that tightening conditions is often cheaper than raising price.</p>

<div class="callout">Never waive building and pest on a property you haven't had inspected just to win — the discount you're chasing can be a fraction of the defect you're buying.</div>
`,
  },
  {
    slug: 'auction-vs-private-treaty-vs-open-offers-queensland',
    title: 'Auction vs Private Treaty vs Open Offers: How QLD Sale Methods Compare',
    desc: 'The three ways Queensland properties get sold — auction, private treaty and transparent offer processes — and what each means for price, cooling-off rights and stress.',
    published: '2026-07-07',
    summary: 'Each sale method distributes information and pressure differently — here is the honest comparison.',
    body: `
<p>Every Queensland property sells by some process for surfacing what buyers will pay. The three main methods differ mostly in one thing: who can see what, and when.</p>

<h2>Private treaty: the default, with a blind spot</h2>
<p>Most Queensland homes sell by private treaty — an asking price, private negotiations, offers invisible to competing buyers. Its weakness cuts both ways: buyers can't see rival offers (so they bid against ghosts, or lowball), and sellers can't easily prove competition exists. The information sits with whoever manages the negotiation — traditionally, the agent.</p>

<h2>Auction: transparent, but on one afternoon</h2>
<p>Auctions solve the transparency problem — every bid is public — but compress it into a single high-pressure event. In Queensland, a buyer at auction generally has no cooling-off period and must bid unconditionally: no finance clause, no building and pest condition, deposit payable on the fall of the hammer. That excludes plenty of genuine buyers who simply can't bid unconditionally, which can thin your field.</p>

<h2>Cooling-off: a key difference buyers should know</h2>
<p>Private treaty contracts for residential property in Queensland typically carry a statutory cooling-off period for the buyer; auction purchases generally don't. The details and any penalties for exercising it are set by legislation — your conveyancer will walk you through what applies to your contract.</p>

<h2>Open offer boards: auction transparency, private-treaty flexibility</h2>
<p>A transparent offer process aims to combine the two: every verified offer is visible to every buyer (like an auction's open bidding), but offers can carry conditions and buyers act on their own timeline (like private treaty). Competition happens in the open across days or weeks rather than minutes, no one is gazumped by an invisible rival, and sellers see exactly what the market genuinely offers.</p>

<div class="callout">Whatever the method, the mechanism that raises price is the same: multiple genuine buyers who can see they're in competition. Choose the process that gets the most real buyers competing for your specific property.</div>
`,
  },
  {
    slug: 'costs-of-selling-a-house-queensland-full-list',
    title: 'The Full Cost of Selling a House in Queensland: Every Line Item',
    desc: 'Every cost a Queensland seller actually faces — commission or flat fee, marketing, conveyancing, mortgage discharge, presentation and moving — with realistic ranges.',
    published: '2026-07-07',
    summary: 'From commission to the removalist: the complete, honest list of what selling costs.',
    body: `
<p>Most sellers budget for the agent and forget the rest. Here's the complete list of what a Queensland sale actually costs, so nothing surprises you at settlement.</p>

<h2>1. The selling fee — the item you control most</h2>
<p>A traditional agent's commission in Queensland commonly runs in the twos-to-threes per cent range — tens of thousands of dollars on a typical Brisbane home — plus marketing charged on top. A flat-fee platform replaces that with a fixed amount in the hundreds. This single choice moves more money than every other line item combined.</p>

<h2>2. Marketing and advertising</h2>
<p>In a traditional campaign, vendor-paid advertising — portal listings, photography, signboards, sometimes print — is typically billed to you separately from commission, often running to several thousand dollars. Check whether any quoted fee includes the portal listing and photography or treats them as extras.</p>

<h2>3. Conveyancing and legal</h2>
<p>Unavoidable in every sale: professional fees plus search disbursements. Get a fixed-fee quote upfront.</p>

<h2>4. Mortgage discharge costs</h2>
<p>If the property is mortgaged, your lender charges a discharge/settlement fee, and there's a government registration fee to remove the mortgage from the title. If you're on a fixed rate, ask your lender about break costs before you commit to a sale date — on recent fixed loans these can be genuinely large.</p>

<h2>5. Presentation: the discretionary spend that pays for itself (sometimes)</h2>
<p>Cleaning, minor repairs, gardening and possibly staging. Small presentation spends usually return their cost; large renovations right before sale usually don't. Fix what's broken, refresh what's cheap, and stop.</p>

<h2>6. Compliance items</h2>
<p>Queensland sellers need compliant smoke alarms at contract and settlement, and a pool safety certificate where there's a pool — budget for an electrician or pool inspector if you're not certain you comply.</p>

<h2>7. Moving and the gap between homes</h2>
<p>Removalists, cleaning the old place, connection fees at the new one — and if your settlement dates don't line up, short-term storage or accommodation. Sellers consistently underestimate this cluster.</p>

<div class="callout">Build the list before you set your price expectations: your true walk-away number is sale price minus all of the above, and knowing it changes how you negotiate.</div>
`,
  },
  {
    slug: 'how-long-does-it-take-to-sell-a-house-brisbane',
    title: 'How Long Does It Take to Sell a House in Brisbane?',
    desc: 'The realistic timeline of a Brisbane property sale, stage by stage — preparation, marketing campaign, contract period and settlement — and what speeds each one up.',
    published: '2026-07-07',
    summary: 'Stage-by-stage: what actually determines whether your sale takes six weeks or six months.',
    body: `
<p>"How long will it take?" has a structural answer: a sale is four sequential stages, each with its own clock. Here's what each stage involves and what actually moves it.</p>

<h2>Stage 1: Preparation (one to three weeks)</h2>
<p>Getting the property photo-ready, professional photography and floor plans, the listing written, and your conveyancer engaged. Sellers control this stage entirely — decisive sellers compress it to days; drifting sellers lose a month before the market ever sees the property.</p>

<h2>Stage 2: The marketing campaign (two to six weeks, typically)</h2>
<p>From listing live to accepted offer. This is the stage everyone means by "how long to sell", and it's driven by three things: price realism (the dominant factor), presentation, and how easy you make it for buyers to inspect. Well-priced Brisbane properties in normal conditions commonly attract their real buyers within the first few weeks — a listing that's had heavy traffic but no offers after that is usually sending a price message, not a patience message.</p>

<h2>Stage 3: Contract period (roughly 30 to 60 days)</h2>
<p>From signed contract to unconditional: the buyer's finance approval and building and pest inspection run during this window, per the conditions in the contract. Sellers speed this up mainly by having a clean, complete contract ready and by fixing obvious B&P items before listing.</p>

<h2>Stage 4: Settlement (per the contract — often 30 days after unconditional)</h2>
<p>The administrative run-in: banks and conveyancers coordinate the money and title transfer. The date was set in the contract, so this stage holds few surprises if the paperwork is in order.</p>

<h2>The honest total</h2>
<p>A prepared, realistically-priced Brisbane sale commonly runs two to four months door to door. The variance is mostly in stages 1 and 2 — the parts the seller controls. Overpricing is the single biggest cause of six-month sales.</p>

<div class="callout">If you have a hard deadline (job move, purchase settlement), work backwards from it and price to sell in the campaign window you actually have — not the one you wish you had.</div>
`,
  },
  {
    slug: 'property-deposits-queensland-explained',
    title: 'Property Deposits in Queensland: Holding Deposits, the 10%, and Deposit Bonds',
    desc: 'How deposits work in a Queensland property sale — who holds the money, when it is paid, what happens if a contract falls over, and how deposit bonds fit in.',
    published: '2026-07-07',
    summary: 'Where the deposit actually sits, when it changes hands, and what happens when contracts fall over.',
    body: `
<p>The deposit is the most misunderstood pile of money in a property sale. Here's how it actually works in Queensland.</p>

<h2>How much is a deposit?</h2>
<p>Convention says ten per cent, but it's negotiable — five per cent is common, and contracts often split it into an initial deposit on signing and a balance when the contract goes unconditional. A bigger, earlier deposit signals a committed buyer, which is worth real negotiating weight to a seller.</p>

<h2>Who actually holds the money</h2>
<p>The deposit doesn't go to the seller. It's held in trust — typically in the trust account of the agency handling the sale or the seller's law firm — until settlement. Trust accounts are regulated and audited; neither party can touch the money while the contract is on foot.</p>

<h2>What happens if the contract falls over</h2>
<p>It depends on why. If the buyer validly terminates under a condition — finance declined, a failed building and pest — the deposit comes back to them. If a buyer simply walks away from an unconditional contract, the seller is generally entitled to the deposit (and potentially further damages). If termination is under the statutory cooling-off period, legislation sets what it costs the buyer. Your conveyancer will confirm what applies to your specific contract.</p>

<h2>Deposit bonds: a deposit without the cash</h2>
<p>A deposit bond is an insurer's guarantee that stands in place of a cash deposit until settlement, when the buyer pays the full price. They suit buyers whose money is tied up — in a property yet to settle, or a term deposit. Sellers can accept or refuse them; a bond is only as good as the issuer behind it, so they warrant a closer look than cash.</p>

<h2>At settlement</h2>
<p>The deposit is released and counts toward the purchase price, with the balance paid by the buyer's lender and their own funds. The trust holding simply ends — the money was always part of the price, just parked safely along the way.</p>

<div class="callout">Sellers: confirm in writing whose trust account holds your deposit and check the balance clears before treating a contract as solid — a deposit promised is not a deposit paid.</div>
`,
  },
];

function guidePage(g) {
  const path = `/guides/${g.slug}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.desc,
    datePublished: g.published,
    author: { '@type': 'Organization', name: 'No Agents Pty Ltd', url: SITE },
    publisher: { '@type': 'Organization', name: 'No Agents Pty Ltd', url: SITE },
    mainEntityOfPage: SITE + path,
  };
  const others = GUIDES.filter(o => o.slug !== g.slug).slice(0, 3);
  return `${head(g.title, g.desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">Guide</span>
<h1 class="sf">${esc(g.title)}</h1>
</div>
<section><div class="wrap">
<article>
<div class="meta">Published ${new Date(g.published).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} · No Agents</div>
${g.body}
</article>
<div class="cta-band">
<h2 class="sf">Ready to sell without the commission?</h2>
<p>$798 flat fee · Domain.com.au listing · Photography &amp; 3D tour included</p>
<a class="cta" href="/sell">List my property →</a>
</div>
${others.length ? `<h2 class="sf" style="margin-top:40px">More guides</h2>${others.map(o => `<a class="card" href="/guides/${o.slug}"><h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p></a>`).join('')}` : ''}
</div></section>
${FOOTER}
</body></html>`;
}

function hubPage() {
  const path = '/guides';
  const title = 'Guides — selling property without an agent in Queensland | no-agents';
  const desc = 'Practical guides to selling your Queensland property privately: the process, the real cost of commission, building & pest, and the contract stages explained.';
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: SITE + path };
  return `${head(title, desc, path, ld)}
<body>
${NAV}
<div class="hero">
<span class="badge">Guides</span>
<h1 class="sf">Selling without an agent, explained.</h1>
<p class="sub">Practical, plain-English guides to the process, the real numbers, and what actually happens at each stage of a Queensland property sale.</p>
</div>
<section><div class="wrap">
${GUIDES.map(g => `<a class="card" href="/guides/${g.slug}"><h3>${esc(g.title)}</h3><p>${esc(g.summary)}</p></a>`).join('')}
</div></section>
${FOOTER}
</body></html>`;
}

export default function handler(req, res) {
  const slug = (req.query.slug || '').toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  if (!slug) return res.status(200).send(hubPage());
  const g = GUIDES.find(x => x.slug === slug);
  if (!g) {
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.status(404).send(`<!DOCTYPE html><html><head><title>Guide not found</title><meta name="robots" content="noindex"></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>We couldn't find that guide</h1><p><a href="/guides">Browse all guides</a></p></body></html>`);
  }
  return res.status(200).send(guidePage(g));
}

export { GUIDES };
