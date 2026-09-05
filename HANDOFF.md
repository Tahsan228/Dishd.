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
