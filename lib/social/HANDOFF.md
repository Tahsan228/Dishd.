# Social workstream handoff

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

## Host-owned integration gaps

- No revenue counter or clean-operation date/history query is defined in the
  checked-in contract. The Business Record labels both metrics unavailable; it
  does not invent revenue, treat account age as clean operation, or sum private
  orders. A read-only counter/view contract is needed to complete those metrics.
- No review-photo bucket/path policy is checked in. The composer supports an
  optional public HTTPS image URL. File upload needs the host's bucket contract.
- The existing logs RLS policy allows owners to update their whole row, including
  verification/linkage columns. The social server action only writes rating,
  body, photo URL, and sourcing answer, and checks the completed order. Protecting
  verification against direct database API writes still needs a host-owned policy
  or trigger change.

## Validation

- Completed locally using VS Code's bundled runtime/compiler: syntax checks for
  all 28 TypeScript files, a strict typecheck of scoring/badges/pagination, and
  all 30 scoring/badge fixtures executed through Node assertions. This fixture
  run used a standalone harness, not the Vitest runner.
- Full Vitest, lint, application typechecking, and browser checks remain for the
  host. This machine has no standalone Node/npm or installed project dependencies;
  none were installed or changed. No host process or dev server was touched.
- `lib/social/credibility.test.ts`: formula arithmetic, every tier boundary,
  penalties, zero-floor reconciliation, tenure, decimal ratings, all badge rules.
- `lib/social/review-validation.test.ts`: rating bounds, explicit sourcing answer,
  review limits, safe photo links, and dropping uneditable fields.
- Host checks: `npx vitest run`, `npx tsc --noEmit`, and `npm run lint`.
- Browser checks at 390px: the four kitchen tiers, empty and unrated diaries,
  buyer profile pagination, owner review saves, appreciation toggles, locked
  records, and the print dialog. Authenticated database flows require host setup.
