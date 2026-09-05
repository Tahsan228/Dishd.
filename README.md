# Dishd

A mobile-first PWA where halal home cooks sell pickup meals from their own kitchens, prove their meat sourcing with uploaded receipts, and build a public credibility record that travels with the business.

Two mechanics carry the whole product. Understand these before writing any code:

1. **The order is the check-in.** Completing a pickup automatically creates a verified log entry (a review). Every review is backed by a real transaction, so ratings cannot be farmed.
2. **Credibility belongs to the business, not the user.** A home cook has no verifiable trading history, which is exactly why they can't get a loan, a lease, or a supplier account. Dishd generates one. The kitchen credibility score is the flagship feature, and it escalates through tiers that unlock real capability.

Buyer profiles exist too — a Letterboxd-style diary of every kitchen you've eaten at — but the kitchen page is the centrepiece.

---

## Who does what

This repo is built by two developers over 24 hours in a **VS Code Live Share** session, each driving an AI coding agent.

| | Host | Guest |
|---|---|---|
| Owns | The marketplace system | Profiles, credibility, badges |
| Agent | Claude | Codex |
| Terminal | Yes — runs all installs, migrations, dev server | **No** — read-only by default |
| `.env.local` | Yes | Not needed |

**Guest: you do not need `.env.local` and cannot run terminal commands.** The host runs `npm run dev` and shares port 3000 through Live Share; open the forwarded `localhost:3000` to see your work. If you need a package installed, a migration run, or a column added — **ask the host**. Do not work around it.

**Live Share is not version control and not a backup.** Only the host's machine holds the code. A daemon auto-commits the working tree every 5 minutes, and it refuses to stage anything credential-shaped.

---

## Setup (host only)

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

`.env.local` needs:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never imported into a client component
ANTHROPIC_API_KEY=              # receipt extraction
STRIPE_SECRET_KEY=              # test mode
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Card checkout is live when `STRIPE_SECRET_KEY` is set. For production also set:

```
STRIPE_WEBHOOK_SECRET=   # from the Stripe dashboard, or `stripe listen`
```

Without it `/api/stripe/webhook` refuses **every** request rather than trusting
an unsigned body — an unsigned "payment succeeded" would let anyone mark any
order paid and collect food. Locally Stripe cannot reach `localhost`, so the
order page confirms the session with Stripe directly on return, which covers a
single buyer; run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
to exercise the webhook itself.

Optional, and **must stay unset in production**:

```
NEXT_PUBLIC_DISHD_DEMO_PASSWORD=   # shows the one-click demo account panel
```

The sign-in page used to carry the seeded password as a literal in a client
component, which shipped it to every visitor and offered one-click sign-in as a
Dishd Verified cook. It now comes from this variable, so a deployment that does
not set it has no demo credentials in its bundle and no demo panel at all.

Verify the credentials actually work before doing anything else:

```bash
npm run check:env      # calls each service, masks secrets, reports what's broken
```

It also tells you whether the migrations have run. Apply `supabase/migrations/*.sql`
**in order** (0002 depends on 0001) via the Supabase SQL editor, then run the seed script.

Note: `.env*` is gitignored, `.env.example` included — the template is not in the repo
on purpose, because an auto-commit daemon plus a file that invites pasting keys into it
is how secrets end up in git history. The variable list above is the source of truth.

---

## File ownership — the collision-avoidance rule

Live Share means you are both editing the *same* files on the *same* machine. There are no branches and no merge conflicts, which sounds good but means two people editing one file will overwrite each other's thinking in real time. The directory split below exists so that never happens.

```
dishd/
├── supabase/migrations/       SHARED · FROZEN     host only
├── lib/
│   ├── types.ts               SHARED · FROZEN     the contract — read, never edit
│   ├── utils.ts               SHARED · FROZEN
│   ├── database.types.ts      GENERATED · FROZEN
│   ├── supabase/              SHARED · FROZEN
│   ├── market/                HOST
│   └── social/                GUEST  ← your code
├── app/
│   ├── layout.tsx             SHARED · FROZEN
│   ├── globals.css            SHARED · FROZEN     design tokens live here
│   ├── (market)/              HOST
│   ├── (social)/              GUEST  ← your routes
│   └── legal/                 HOST
└── components/
    ├── ui/                    SHARED · FROZEN
    ├── market/                HOST
    └── social/                GUEST  ← your components
```

### Hard rules

1. **Only edit files under `lib/social/`, `app/(social)/`, and `components/social/`.**
2. **Never edit anything marked FROZEN or HOST.** Need a column, a query, or a change to a shared type? Ask the host. Do not write a migration.
3. **Never add a dependency.** Everything needed is already installed (see below).
4. **Never create barrel/index re-export files.** They are collision magnets that force both devs into one file. Import from full paths.
5. **You may import from HOST files. You may not modify them.** `import { cn } from "@/lib/utils"` is fine.

### Already installed — do not add to this list

`@supabase/supabase-js` · `@supabase/ssr` · `@anthropic-ai/sdk` · `zod` · `stripe` · `maplibre-gl` · `clsx` · `tailwind-merge` · `lucide-react` (icons) · `date-fns` · `vitest` (dev)

---

## The data contract

Read `lib/types.ts` in full before starting — it is the authoritative source. The parts most relevant to the social workstream:

`kitchens` carries **denormalised counters maintained by Postgres triggers**. Read them directly with a single-row query. **Never aggregate across `orders` and `logs` at render time** — the counters exist precisely so you don't have to, and doing so will be slow and will disagree with the rest of the app.

```ts
export type KitchenCounters = {
  orders_completed: number;
  avg_rating_10: number;        // 0-10, i.e. 4.5 stars -> 9
  distinct_customers: number;
  repeat_customers: number;
  trust_streak: number;         // consecutive verified sourcing batches
                                // (batches awaiting review are skipped, not counted as failures)
  permit_status: "none" | "claimed" | "verified";
  upheld_flags: number;
  open_incidents: number;
  cook_cancellations: number;
  created_at: string;           // ISO
};
```

**Buyer-side counters come from a database view, not a table.** `BuyerCounters` is
served by the `buyer_counters` view (defined in migration 0002), one row per profile,
keyed by `user_id`. It runs with `security_invoker`, so RLS applies as the caller.

```ts
const { data } = await supabase
  .from("buyer_counters")
  .select("*")
  .eq("user_id", profileId)
  .single();          // -> BuyerCounters
```

Same rule as the kitchen counters: read the view, do not aggregate `logs` and
`log_likes` yourself.

Also defined in `lib/types.ts` and used by your components: `BuyerCounters`, `CredibilityTier`, `BuyerTier`, `ScoreComponent`, `CredibilityResult`, `BadgeDef`, `KitchenPublic`, `ProfilePublic`, `Log`, `LogWithAuthor`.

**Conventions that apply everywhere:** money is always integer cents (use `formatCents` from `lib/utils`) · ratings are stored 0–10 and displayed 0–5 stars (use `toStars`) · timestamps are ISO strings.

---

## What the guest builds

### 1. `lib/social/credibility.ts`

Pure functions. No database access, no React. This is the highest-priority file because everything else depends on it, and because you can unit-test it immediately without waiting on the order flow.

**Kitchen score — implement exactly this. The demo script narrates these numbers, so they must not drift.**

```
score = 12 * orders_completed
      +  8 * avg_rating_10
      + 20 * trust_streak
      + 30 * (permit_status === "verified" ? 1 : 0)
      +  5 * repeat_customers
      +  2 * tenure_weeks
      - 40 * upheld_flags
      - 25 * open_incidents
      - 15 * cook_cancellations
```

- `tenure_weeks = floor((now - created_at) / 7 days)`
- Floor the final score at 0. Never show a negative score.

| Tier | Threshold | Unlocks (display this on the page) |
|---|---|---|
| `new_kitchen` | 0 | 5 orders/day |
| `established` | 150 | 15 orders/day, appears in "Rising" |
| `trusted_kitchen` | 400 | Featured placement, 30 orders/day, reduced commission |
| `dishd_verified` | 800 | Top placement, exportable Business Record |

**Buyer score:**

```
score = 10 * verified_logs
      + 15 * distinct_kitchens
      +  5 * substantive_reviews     (body length >= 80 chars)
      +  3 * photo_logs
      +  2 * likes_received
      + 25 * upheld_flags
      - 20 * dismissed_flags
```

Tiers: `newcomer` 0 · `regular` 100 · `trusted_taster` 300 · `community_pillar` 700.

**Required exports:**

```ts
export function scoreKitchen(c: KitchenCounters, now?: Date): CredibilityResult;
export function scoreBuyer(c: BuyerCounters, now?: Date): { score: number; tier: BuyerTier };
export function tierLabel(t: CredibilityTier | BuyerTier): string;
```

`CredibilityResult.components` must return **one `ScoreComponent` per line of the formula above, including the negative ones when non-zero** — the kitchen page renders the full breakdown. Transparency is the product here; this is deliberately not a black box. Each component carries a `detail` string like `"18 batches × 20"`.

The `now` parameter exists so tests can pin the date. Default it to `new Date()`.

### 2. `lib/social/badges.ts`

Badges split into two kinds, and the distinction matters:

**Computed** — derived from counters on read. No cron, no background jobs.

| Code | Applies to | Criteria |
|---|---|---|
| `chain_of_trust` | kitchen | `trust_streak >= 10` |
| `permit_verified` | kitchen | `permit_status === "verified"` |
| `hundred_meals` | kitchen | `orders_completed >= 100` |
| `neighborhood_favorite` | kitchen | `repeat_customers >= 20` |
| `spotless` | kitchen | `orders_completed >= 50 && open_incidents === 0 && upheld_flags === 0` |
| `first_bite` | user | `verified_logs >= 1` |
| `explorer` | user | `distinct_kitchens >= 10` |
| `photographer` | user | `photo_logs >= 10` |
| `wordsmith` | user | `substantive_reviews >= 10` |
| `trust_guardian` | user | `upheld_flags >= 1` |

**Granted** — cannot be computed from counters; they are rows in the `kitchen_badges` / `user_badges` tables, written by the seed script. Read them from the DB and merge with the computed ones.

| Code | Applies to | Meaning |
|---|---|---|
| `founding_kitchen` | kitchen | One of the first 25 kitchens |
| `always_on_time` | kitchen | 95%+ ready-on-time |
| `founding_taster` | user | One of the first 100 accounts |

**Required exports:**

```ts
export const BADGES: BadgeDef[];                                    // all 13, with labels + descriptions
export function computedKitchenBadges(c: KitchenCounters): string[];
export function computedUserBadges(c: BuyerCounters): string[];
```

Write the copy for each badge's `label` and `description` yourself — keep it warm and short, no more than about eight words for a description.

### 3. Three components on the kitchen page

The kitchen page (`app/(market)/k/[slug]/page.tsx`) is a **host-owned file that composes your components**. It already imports them and will not change. Stubs exist at the paths below — replace their internals, do not move or rename them, and do not change the signatures.

```ts
// components/social/kitchen-credibility-panel.tsx
export async function KitchenCredibilityPanel({ kitchenId }: { kitchenId: string })
// components/social/kitchen-badge-shelf.tsx
export async function KitchenBadgeShelf({ kitchenId }: { kitchenId: string })
// components/social/review-feed.tsx
export async function ReviewFeed({ kitchenId }: { kitchenId: string })
```

Each is a **React Server Component taking exactly one prop and doing its own Supabase query.** Do not add props. Do not lift state into the page. If a piece needs interactivity, keep the server component as a wrapper and nest a `"use client"` child inside it.

`KitchenCredibilityPanel` is the most important surface in the app. It should show the tier, the score, the full component breakdown, and how far the kitchen is from the next tier.

### 4. Buyer profile — `app/(social)/u/[handle]/page.tsx`

The Letterboxd half. Diary of every kitchen visited (reverse chronological), stats, badge shelf, rating distribution histogram, buyer tier. Verified logs get a visible mark; unverified logs render in a visibly lesser treatment.

### 5. Review composer + `app/(social)/log/[id]/page.tsx`

A permalink page per log, and the composer used after an order completes. The composer asks for a rating, optional body, optional photo, **and one extra question**: *"Did the packaging and quality match the cook's sourcing claim?"* → writes `sourcing_affirmed`. That field feeds the trust pipeline, so don't drop it.

### 6. Business Record — `app/(social)/k/[slug]/record/page.tsx`

Unlocked at `dishd_verified`. A one-page, print-styled document a cook can hand to a bank or a landlord: verified orders fulfilled, revenue, repeat-customer rate, average rating, halal sourcing streak, months of clean operation.

Build it as a print-styled HTML page — `@media print` rules are already in `globals.css`, and `.no-print` hides chrome. **Do not add a PDF library.** The browser's own "Save as PDF" is the export.

This is the emotional payoff of the entire pitch. Make it look like a document, not a web page.

---

## Design system

Tokens are defined in `app/globals.css` using Tailwind v4's `@theme`, which means **every token is already a utility class**: `bg-forest`, `text-ink-muted`, `border-line`, `bg-brass` and so on. Use those. Do not hardcode hex values, and do not add new colours.

| Token | Hex | Use for |
|---|---|---|
| `cream` | `#FEF8F6` | App background, everywhere |
| `forest` | `#00372C` | Primary: buttons, header, credibility panel |
| `forest-deep` | `#002620` | Hover / pressed |
| `forest-soft` | `#E6EEEB` | Tinted fills, selected states |
| `brass` | `#B8873B` | Badge fills, tier marks, seals |
| `brass-ink` | `#7A5A22` | Brass as **small text** |
| `clay` | `#B4432F` | Mismatch, ban tombstone, incidents |
| `amber` | `#C87A2C` | Pending, awaiting review |
| `ink` | `#16241F` | Body text |
| `ink-muted` | `#5B6B64` | Secondary text |
| `line` | `#E8DCD6` | Hairlines, borders |
| `surface` | `#FFFFFF` | Raised cards on the cream ground |
| `surface-sunk` | `#F7EDE8` | Inset areas, image placeholders |

**There is deliberately no separate "success green."** The brand green *is* the verified colour — a forest seal with a check. A second green next to `forest` would muddy the identity. That leaves brass meaning exactly one thing: **something was earned**. So: verified = forest, earned = brass, broken = clay.

**`brass` is only 3.1:1 on cream — fills, icons, and large text only, never body copy.** Use `text-brass-ink` (5.9:1) whenever brass needs to be small text. This is the single easiest mistake to make when styling badges.

**Credibility tiers escalate through the palette** — grey → green → gold → gold-on-green, readable at a glance without reading a word:

| `new_kitchen` | `established` | `trusted_kitchen` | `dishd_verified` |
|---|---|---|---|
| `ink-muted` outline | `forest` outline | `brass` fill | brass on `forest`, filled seal |

**Type.** Fraunces for display (headings, the score, anything editorial), Inter for UI. Both wired up in `app/layout.tsx` — use `font-display` and the default sans, don't import fonts yourself. Put `.tabular` on any number that updates (scores, stats) so digits don't jitter.

**No dark mode.** The palette is committed light. Don't add `dark:` variants.

Star ratings: `brass` filled, `line` empty.

---

## Querying

RLS is on for every table and the anon key is what runs, so you get exactly what a real visitor gets.

```ts
import { createServerClient } from "@/lib/supabase/server";

export async function KitchenBadgeShelf({ kitchenId }: { kitchenId: string }) {
  const supabase = await createServerClient();
  const { data: kitchen } = await supabase
    .from("kitchens")
    .select("orders_completed, avg_rating_10, repeat_customers, trust_streak, permit_status, upheld_flags, open_incidents, cook_cancellations, created_at")
    .eq("id", kitchenId)
    .single();
  // ...
}
```

One RLS behaviour to expect rather than debug: **`kitchen_addresses` will return zero rows for you.** Exact addresses are gated to the kitchen owner and to buyers with an accepted order. That is correct and deliberate — never try to route around it, and never display an exact address on a profile page.

---

## Verifying your own work

**Unit tests first — these need no database and no order flow, so you are never blocked.** `credibility.ts` and `badges.ts` are pure functions over plain counter objects. Write `lib/social/credibility.test.ts` with fixtures for each tier boundary and run `npx vitest run`. Ask the host if you need the command run.

Cases worth pinning: a brand-new kitchen scores 0 and does not go negative · a kitchen exactly on 150 is `established`, 149 is `new_kitchen` · penalties actually subtract · `components` sums to `score`.

**Then visual.** The host seeds kitchens spanning all four tiers. Develop against those pages and check every tier renders, not just the happy one.

Every screen must work at **390 px wide**, one-handed. This is a phone app that happens to run in a browser.

---

## Conventions

- **Server Components by default.** `"use client"` only where interactivity genuinely requires it.
- Tailwind utilities only — no CSS modules, no styled-components, no inline style objects for anything the tokens cover.
- `kebab-case.tsx` filenames. Named exports, not default exports.
- `cn()` from `@/lib/utils` for conditional classes.
- Money in integer cents. Ratings stored 0–10, displayed 0–5.
- Keep files focused. If a component passes ~200 lines, split it — inside your own directory.

---

## Host answers to the social workstream's open questions

Raised in `lib/social/HANDOFF.md`. All three are now resolved host-side.

**1. Revenue and operating history for the Business Record.** Migration 0004 adds
two trigger-maintained columns on `kitchens`, so the record can show real figures
instead of labelling them unavailable:

```ts
revenue_cents: number;              // sum of completed orders
first_completed_at: string | null;  // ISO; operating history = now - this
```

"Clean operation" is `upheld_flags === 0 && open_incidents === 0`, both already
on the row. Do not infer revenue from anything else, and do not treat account age
as trading history — a kitchen can exist for months before its first sale.

**2. Review photo storage.** A public `photos` bucket exists. Upload to
`photos/reviews/<logId>.<ext>` with the user-scoped client and store the public
URL on `logs.photo_url`. Keep accepting a pasted HTTPS URL as the fallback.
(`receipts` is a separate bucket and is not for review photos.)

**3. Verification forgery — you were right, and it was exploitable.** Confirmed by
direct API call: a buyer could PATCH their own log to `is_verified = true` on a
review never backed by an order. Migration 0004 adds a BEFORE UPDATE trigger that
restores `buyer_id`, `kitchen_id`, `order_id` and `is_verified` to their previous
values on every update. RLS could not express this, because a WITH CHECK
expression cannot see the OLD row. Your server action needs no change: buyers keep
full control of what a review *says* and none over whether it *counts*.
`npm run verify` now covers it.

---

## Current state

**Done:** Next.js 16 + React 19 + Tailwind v4 scaffold · all dependencies installed · design tokens in `globals.css` · `lib/types.ts` and `lib/utils.ts` · core schema in `supabase/migrations/0001_init.sql`.

**Host done since:** RLS policies and counter triggers · Supabase clients · `app/layout.tsx` with fonts · storage buckets · `npm run check:env` · Chain of Trust receipt checks (`lib/market/receipts.ts`, 10 passing tests) and submission action.

**Host still to do:** seed data · cook onboarding · receipt upload UI and reviewer queue · menu CRUD · discovery map · cart, checkout and order lifecycle · legal pages · PWA manifest.

**Receipts are reviewed by a human, not by AI.** The cook declares what is on the
receipt and uploads it as evidence. Deterministic checks (duplicate image,
duplicate store/date/total across all kitchens, registered-source match,
freshness) run instantly and reject on the spot; everything that passes sits at
`match_status = 'pending'` until a reviewer confirms the image. So a batch has
four states — `pending`, `verified`, `mismatch`, `unreadable` — and only
`verified` should render as a green sourcing badge. Show `pending` in amber.

**Guest still to do:** everything under "What the guest builds" above.

---

## Before this runs for real people

The app was demo-shaped in several places that mattered once a stranger could
reach it. Those are now fixed in code, but three of the fixes are migrations
that **have not been applied to any database** — apply `0005`, `0006` and `0007`
in order, then re-run the seed.

| Migration | Why it exists |
|---|---|
| `0005_protect_order_lifecycle.sql` | `orders_update` had no `WITH CHECK` and no transition guard, so a buyer could `PATCH` their own order to `completed` over the public REST API. That fires the autolog trigger, mints a review with `is_verified = true`, and adds to `orders_completed` and `revenue_cents` — defeating the one claim the product rests on, and inflating the figure on a Business Record handed to a bank. Same class of hole `0004` closed on `logs`, one level upstream. Also blocks buyer-set `payment_status` and `declined`-griefing of a cook's score. |
| `0006_account_signup.sql` | There was no sign-up at all, and no trigger behind `profiles` — an account made through `signUp()` would land in `auth.users` with no profile row and be signed in but invisible. A `SECURITY DEFINER` trigger on `auth.users` now builds the profile, settles handle collisions, and backfills. |
| `0007_storage_buckets.sql` | The `photos` and `receipts` buckets were created by hand in the dashboard, so a fresh project had neither and both uploads failed. |

Still genuinely missing, and each is a real gap rather than polish:

- **Paying the cook.** Card checkout works — Stripe Checkout, a signed webhook,
  and a return-path confirmation — but the money lands in the *platform*
  account. Stripe Connect is not built: `kitchens.stripe_account_id` is still
  unused, so a card order is money Dishd holds and owes the cook rather than a
  settled transfer. Cash at pickup is the only path that fully settles today.
  Connect onboarding plus destination charges is the remaining work.
- **Password reset.** There is no "forgot password" flow, so a real user who
  forgets one is locked out permanently.
- **Email deliverability.** Sign-up assumes Supabase's built-in mailer; a real
  deployment needs its own SMTP or confirmations will not arrive reliably.
- **Reviewer queue.** Receipts sit at `pending` until a human confirms them,
  and there is no screen for that human yet.
- **Legal review.** `app/legal/` describes the software honestly but has not
  been seen by a lawyer.

Seeded fixtures to develop against will be `/k/aminas-kitchen` (a `trusted_kitchen`) plus one kitchen at each other tier, and `/u/yusuf`. The host will confirm the exact slugs once the seed lands.
mr collllllddddd booooiiii