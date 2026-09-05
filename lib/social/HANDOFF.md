# Archived social workstream handoff

**Historical only. The user requested a full rebuild. See ../../HANDOFF.md and ../../AGENTS.md for the current sequential, whole-project workflow. The implementation and host/guest instructions below no longer describe the active application.**

All source changes are confined to `lib/social`, `components/social`, and
`app/(social)`. The existing three kitchen component exports and their
`{ kitchenId: string }` signatures are preserved. Shared files, marketplace files,
migrations, and dependency manifests are unchanged.

## Integration

- Kitchen components now query the user-scoped Supabase client and handle empty,
  unavailable, and unconfigured states.
- Buyer profile: `/u/[handle]`; log permalink and owner-only composer: `/log/[id]`.
  After completing an order, link the buyer to the auto-created log's ID. The
  composer updates that row; it does not insert logs or write verification fields.
- All kitchen diary entries: `/reviews/[kitchenId]`. Profiles and review listings
  use 20-entry pages. The profile histogram explicitly covers the displayed page.
- Business Record: `/k/[slug]/record`, gated to an active kitchen with at least
  800 credibility points, with a browser print / Save as PDF button.
- Unrated auto-check-ins are represented as nullable locally; the frozen `Log`
  contract still says `number`, while migration 0001 permits `null`.
- Kitchen scores preserve all nine formula terms. If penalties take the raw total
  below zero, a clearly labelled floor adjustment reconciles the breakdown to zero.

## Host integration (checked against main at 5dae51a)

- Migration 0004's `revenue_cents` and `first_completed_at` are now used by the
  Business Record. Full operating months start at the first completed order.
  Clean standing follows the documented zero-upheld-flags / zero-open-incidents
  rule and is described on the record; account age is never substituted.
- Social pages now reuse the host `SiteHeader`. `/diary` redirects to the current
  buyer profile, or `/signin?next=%2Fdiary`. Appreciation sign-in also returns to
  its log permalink.
- The `photos/reviews/<logId>.<ext>` contract is acknowledged. HTTPS photo links
  remain supported; file upload is the next integration checkpoint.
- The host's provenance-update trigger is compatible with the review action,
  which only writes rating, body, photo URL, and sourcing answer after checking
  the buyer and completed order.

### One host-owned placement remains

The completed-order screen currently says the meal is in the diary but has no
link to rate it. This guest-owned server component is ready to drop into its
completed state (no additional queries or props are needed in the host page):

```tsx
import { OrderReviewLink } from "@/components/social/order-review-link";

{order.status === "completed" && <OrderReviewLink orderId={id} />}
```

`OrderReviewLink` resolves the trigger-created log for the signed-in buyer. It
does not create a log or expose another buyer's entry. A `/diary` link in the
marketplace header would also make the personal diary easier to discover.

## Validation

- Restored the existing lockfile dependencies in the isolated guest checkout,
  without modifying dependency manifests. No host process or dev server touched.
- Actual Vitest: 68 tests pass, including the host's 10 receipt tests and the new
  Business Record fixtures. Full application `tsc --noEmit` passes. Social lint
  passed before the latest navigation/record additions; it will be rerun.
- Live database and browser flow verification still requires configured test
  services. No seed, migration, or verification script has been run against the
  host's database from this checkout.
- `lib/social/credibility.test.ts`: formula arithmetic, every tier boundary,
  penalties, zero-floor reconciliation, tenure, decimal ratings, all badge rules.
- `lib/social/review-validation.test.ts`: rating bounds, explicit sourcing answer,
  review limits, safe photo links, and dropping uneditable fields.
- Host checks: `npx vitest run`, `npx tsc --noEmit`, and `npm run lint`.
- Browser checks at 390px: the four kitchen tiers, empty and unrated diaries,
  buyer profile pagination, owner review saves, appreciation toggles, locked
  records, and the print dialog. Authenticated database flows require host setup.
