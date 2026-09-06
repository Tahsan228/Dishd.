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
