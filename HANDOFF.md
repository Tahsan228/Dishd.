# Current handoff

## Active task

Synced this checkout to origin/main at b91542c, at the user's explicit request. Earlier uncommitted profile rebuild work is archived in a local Git stash; do not restore it into this project.

The user asks for:
- Fix sourcing receipt crash and inability to review a collected order.
- Smaller top-left logo; cleaner, less cramped typography and animations.
- Real spendable rewards for completed purchases/visits; reviewed promotional-video missions and app-install engagement.
- Community page with buyer reviews, people, business posts, sorting/filtering, weekly winners, popular kitchens, and confirmed safety notices.
- Rich reviews with stars, images, mentions, and kitchen hyperlinks.
- Bergen County NJ / New York demo locations.
- Stronger checkout quality/halal standards and a reporting path for violations.

## First checkpoint

- Restored current main dependencies; this machine now has Node at C:\Program Files\nodejs\node.exe.
- Fixed the concrete 1 MB Server Action transport mismatch: limit 16 MB; receipt files validated up to 8 MB. Shared gallery validation caps three images and 12 MB combined.
- Receipt form catches transport failures and retains the declaration. Server handles service failures, checks duplicate-query errors, removes orphan uploads when persistence fails, and refreshes onboarding after success.
- TypeScript passes. Upload tests and live workflow checks follow.
- Restarted this checkout's preview at http://localhost:4173. Logs: ignored .preview/main-server.log.
- No .env.local is present here or in the earlier neighboring checkout. Asked the user for its local path; live Supabase verification is pending that information. Do not invent keys or run the destructive seed script against an existing database.

## Next work

Second checkpoint: order pages refresh while the cook progresses the pickup. Missing logs have a recoverable review action. Migration 0008 repairs missing historical logs, makes new log verification derive from completed orders, runs autolog after order updates, and adds review gallery/subrating fields. Apply it before using the new review queries. Rich review composer supports up to three images, half-star ratings, food/value/packaging scores, @mentions, and linked kitchens. Smaller logo and wider local Fraunces/DM Sans typography are in place. Font licenses are bundled in public/fonts.

Complete the order-to-review recovery path and advanced review composer, then rewards / community migrations and interfaces, regional demo fixtures, quality policies, and the visual refinement. Continue the user's full request, keeping checkpoints reviewable. Update validation and remaining limitations here.

## Workflow

Active agent owns the whole app; old guest/frozen-directory restrictions are retired. Main is the shared continuation branch. Commit/push about every ten minutes while active. Use DESIGN.md for the design contract.

Third checkpoint: migrations 0009 and 0010 add the private reward ledger, review/pickup/purchase awards, moderated promotion claims, community posts and reporting, single-use credits, and transactional checkout. Checkout calls a service-only RPC after authenticating the buyer; direct client order/item inserts are now prohibited. Credit discounts reduce the actual cash/Stripe total and return on cancellation. Consent version 2026-09-05.2 requires quality/allergen/halal standards. Apply 0008-0010 together before using these changes. Isolated PostgreSQL test: npm run test:db, 26 checks pass; no live database was touched. Interfaces for community, rewards and moderation are the next checkpoint.

## Fourth checkpoint (Claude)

Built the interfaces the third checkpoint left: `/rewards` and `/community`,
plus the reporting path.

- `/rewards` renders the 0009 ledger: balance, lifetime earned, progress to the
  next credit, redemption, available credits, the earning table, and video
  mission submission. `EARN_RULES` mirrors the triggers rather than restating
  them, so the page cannot promise points the database will not award.
- `/community` separates verified reviews from business posts, with search,
  cuisine facets and four sorts. Rankings refuse thin evidence: kitchen of the
  week needs 3+ verified reviews in seven days and no upheld flags, and
  "confirmed problems" lists only upheld flags, suspensions and bans — never a
  low rating.
- `ReportDialog` on the completed-order page, tied to the order so a reviewer
  can see which pickup is described.
- Market moved to Bergen County NJ / New York. `lib/market/jurisdictions.ts`
  names the permit per state, because MEHKO is Californian and telling an NJ
  cook to get one sends them after a licence that does not exist there.

Two defects fixed on the way: the report action wrote `detail`/`user` where the
schema has `details` and no such target_type (every report would have failed),
and the checkout reward selector rendered literal "?" where a separator and
minus sign belonged.

### Still open

- **Migrations 0005 and 0008-0010 are not applied to the live database.** I
  verified directly: `community_posts`, `reward_ledger` and `dishd_place_order`
  all 404. Checkout calls that RPC, so ordering is broken against the live
  project until they are run. Apply 0005, then 0008, 0009, 0010, then re-seed.
- Reviewer queue: `dishd_review_reward_claim` and flag disposition are
  service-role only, with no moderator UI. Claims and reports will sit pending.
- Stripe Connect: card money lands in the platform account, not the cook's.

## Monetary system checkpoint (Codex, 2026-09-06)

User explicitly requested concurrent, separate payment work while Claude updated the signed-out landing page. Claude's landing/header/location/logo files were left alone, as was the existing preview on port 4173. No subagents were used.

- Migration 0011 adds optional tips (integer cents) and a private 5% cash commission ledger for new orders. Base: discounted food only, rounded half up; tips excluded. Completed cash pickups accrue one fee; canceled orders accrue none; old orders are not charged retroactively.
- Kitchen owners settle accumulated fees by card at /cook/payments. Seven-day due period; an overdue balance of at least $0.50 pauses new cash orders. Smaller balances carry forward. Existing pickups can still complete.
- Billing reserves an immutable batch, reuses Stripe sessions, recovers interrupted saves, verifies amount/currency/identity, and settles atomically. Webhooks return retryable errors on failed persistence. Unpaid card orders cannot progress to preparation.
- Checkout and order/dashboard totals show tips separately. Tips do not enter food revenue, purchase rewards, or credibility. Existing Stripe Connect payout limitation remains: card meal/tip money is held by Dishd pending kitchen payout setup.
- Fictional demo ads appear on the cook dashboard and completed orders, plus /demo/ads. No ad network, tracking, or real offers.
- Current checks: TypeScript passes; 244 unit tests and 46 isolated PostgreSQL checks pass. Browser flows and live configuration inspection follow. Migration 0011 has only been applied in isolated test PostgreSQL so far; do not claim live billing verified.

### Monetary verification and activation

- Additional 23 Stripe unit tests pass: exact food-plus-tip total, unrelated/underpaid sessions rejected, interrupted session save recovered, existing checkout reused, attempt rotation only after expiry, and webhook persistence errors propagated for retries. Total: 267 unit tests; 46 isolated PostgreSQL checks. TypeScript and scoped ESLint pass.
- Browser checks on the shared http://localhost:4173 preview, using seeded demo accounts only: tip presets, custom $2.35 total, invalid $100.01 blocking, no-tip reset, demo-ad links, 390px and 1280px payment/ad content, and the cook payment page's missing-schema state. No orders or card charges were created. Screenshots and the local browser runner are ignored under .preview/.
- The signed-in shared SiteHeader overflows 390px (navigation reaches about 452px). This is in Claude's active area, so it was deliberately not modified. Payment content itself fits 390px. Record for Claude to address separately.
- Live read-only check: .env.local contains Supabase URL/anon/service-role keys, app URL, Stripe test key, and demo password. It has NO database connection string, management token, or STRIPE_WEBHOOK_SECRET. cash_commissions returns 404 and orders.tip_cents is missing. The user suggested .env.local; its variable names were checked without revealing values, and no alternate schema-management credential exists there.
- Activation still required: apply supabase/migrations/0011_cash_commission_and_tips.sql after 0010 in the Supabase SQL editor (or provide a local file path containing schema-management credentials), then configure the Stripe signing secret for /api/stripe/webhook. The migration is fully tested locally but has NOT been applied to the live project. Never claim live money collection verified. Existing order/dashboard reads tolerate the column rollout; checkout returns a readable temporary-unavailability message until the new RPC is present.
- Cash fee checkout uses the existing NEXT_PUBLIC_APP_URL for redirects; match it to the intended preview/deployment. Card payouts to cooks still require Stripe Connect; this work does not claim those transfers are implemented.

## Order timing checkpoint (Claude, 2026-09-06)

The user asked for four things on the order tracking page — notifications when
the kitchen updates status or messages, a kitchen-set cooking estimate, a paid
priority option, and scheduled orders — plus a fix for the profile name being
unreadable against a banner image. All five are done. The user confirmed
0001-0014 are already applied to the live project.

**Another agent was writing to this same checkout while this work ran**
(`discovery-feed.tsx`, `nearby-map.tsx`, `pickup-review-panel.tsx` and friends
appeared mid-session). Their files were left alone; the TypeScript errors in
them are theirs and are not from this work. Every commit here staged only its
own paths.

### What was built

- **Migration 0015.** Kitchen offer terms (`default_prep_minutes`,
  `priority_fee_cents`, `accepts_scheduled`) and order terms
  (`priority_fee_cents`, `scheduled_for`, `prep_minutes`, `ready_estimate_at`).
  No new order status: a scheduled order genuinely is `pending` until the cook
  accepts, so the dashboard splits on `scheduled_for` rather than re-opening the
  0005 lifecycle trigger.
- **`dishd_place_order` wrapped again**, the way 0011 wrapped it. Priority sends
  intent only; the fee is read from the kitchen row, so a crafted form cannot
  name its own price. A kitchen that does not sell priority raises rather than
  charging nothing. Scheduling is revalidated in SQL: 15-minute steps, at least
  30 minutes out, at most 7 days.
- **The priority fee is the kitchen's sale**, so it joins discounted food in the
  5% cash commission base and in `revenue_cents`. Tips stay outside both.
- **Notifications** fire on status change, a message from the kitchen, and a
  revised estimate. The component is now the order page's only poller, because
  the old timer ran only while the tab was visible — a backgrounded tab learned
  nothing and had nothing to announce.
- **Profile name** moved off the banner. The avatar and tier mark still overlap
  it; both carry their own opaque ground.

### The honest limit on notifications

They arrive **while Dishd is open in the browser**, including in a background
tab. That is what the UI says. Delivery with the app closed needs a service
worker, a push subscription and VAPID keys this deployment does not have. Do not
let this copy drift into promising more than that without adding the
infrastructure first.

### A hole closed on the way

`kitchens_update` was `using (owner_id = auth.uid())` with no WITH CHECK and no
guard, and every credibility counter lives on that row. A cook could PATCH their
own `avg_rating_10`, `orders_completed` and `revenue_cents` through the public
REST API and buy the top tier without cooking anything — the same class of hole
0004 closed on `logs` and 0005 on `orders`, left open on the table that stores
the score. 0015 adds `trg_kitchens_00_guard`.

The discriminator is **trigger depth, not `auth.uid()`**: `dishd_recompute_kitchen()`
runs from the orders trigger under the buyer's or cook's own JWT, so freezing on
a user JWT alone would have broken every counter. A direct PATCH reaches the
guard at depth 1, a nested recompute at depth 2. There is a database check
asserting completion still updates the counters, which is the one to keep if
this guard is ever edited.

### Verification

- 366 unit tests pass (73 new in `lib/market/order-timing.test.ts`).
- 67 isolated PostgreSQL checks pass, up from 46. The 21 new ones are in
  `scripts/test-timing-database.mjs`: scheduling bounds and steps, priority
  pricing and the fee base, what a buyer may not rewrite after checkout, what a
  cook may, and the kitchens guard.
- TypeScript and ESLint pass on every file touched here.
- `/`, `/cart` and `/cook` serve 200 from the shared preview on port 4173.
- **Live behaviour of the new features is NOT verified**, because 0015 is not
  applied. Do not claim it is.

### Activation

Apply `supabase/migrations/0015_order_timing_priority_and_alerts.sql` after 0014
in the Supabase SQL editor. Until then the app degrades on purpose rather than
breaking:

- `loadKitchenTerms` returns null when the columns are absent, so neither
  priority nor scheduling is offered.
- The cook dashboard asks for the new columns in a separate query, so a missing
  column loses the settings panel rather than the whole dashboard — naming them
  in the main select would have shown an established cook the "start selling"
  screen.
- An ordinary checkout falls back to the 0014 signature of `dishd_place_order`.
  An order that actually asked for priority or a slot is refused with a message
  saying the feature is not switched on, rather than placed silently without the
  thing the buyer chose.

### Still open

- The signed-in `SiteHeader` overflowing 390px, recorded by Codex earlier, is
  still not addressed.
- Nothing reminds a buyer that a booking is coming up; the countdown only exists
  on the order page while it is open.
- A cook can revise the estimate but there is no record of having done so, so a
  kitchen that habitually slips cannot be told apart from one that does not.
