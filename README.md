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

**Live Share is not version control and not a backup.** Only the host's machine holds the code. The host commits to git every hour.

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

Apply `supabase/migrations/*.sql` in order via the Supabase SQL editor, then run the seed script.

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
  permit_status: "none" | "claimed" | "verified";
  upheld_flags: number;
  open_incidents: number;
  cook_cancellations: number;
  created_at: string;           // ISO
};
```

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

## Current state

**Done:** Next.js 16 + React 19 + Tailwind v4 scaffold · all dependencies installed · design tokens in `globals.css` · `lib/types.ts` and `lib/utils.ts` · core schema in `supabase/migrations/0001_init.sql`.

**Host still to do:** RLS policies and counter triggers · Supabase clients · `app/layout.tsx` with fonts · seed data · cook onboarding · Chain of Trust receipt pipeline · menu CRUD · discovery map · cart, checkout and order lifecycle · legal pages · PWA manifest.

**Guest still to do:** everything under "What the guest builds" above.

Seeded fixtures to develop against will be `/k/aminas-kitchen` (a `trusted_kitchen`) plus one kitchen at each other tier, and `/u/yusuf`. The host will confirm the exact slugs once the seed lands.
