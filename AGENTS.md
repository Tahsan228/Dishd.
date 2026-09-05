# AGENTS.md — Dishd

Read `README.md` first. It is the full contract; this file is the short version of the rules you must not break.

Two agents work in this repo **at the same time, on the same machine, over VS Code Live Share.** Another agent (Claude) is editing other files in this same working tree *right now*. Files will change under you without warning — that is expected, not a bug. Do not "fix" or revert code you did not write.

## You own exactly three directories

```
lib/social/          your logic
app/(social)/        your routes
components/social/   your components
```

Create files freely inside those. Do not create files outside them.

## Never do these

1. **Never edit files outside your three directories.** Especially not `lib/types.ts`, `lib/utils.ts`, `lib/supabase/`, `lib/market/`, `app/(market)/`, `app/layout.tsx`, `app/globals.css`, `components/ui/`, `components/market/`, or anything in `supabase/`. You may *import* from them; you may not change them.
2. **Never write or edit a database migration.** If you need a column or an index, stop and ask the human to relay it to the host.
3. **Never add, remove, or upgrade a dependency.** Everything you need is installed. If you genuinely need something new, ask — don't `npm install`.
4. **Never create barrel/index re-export files.** Import from full paths.
5. **Never run terminal commands.** You are the Live Share *guest*; the terminal is read-only and the dev server belongs to the host. Ask the human to run builds, tests, or migrations for you.
6. **Never hardcode a hex colour.** The palette is Tailwind v4 `@theme` tokens in `globals.css` — use `bg-forest`, `text-ink-muted`, `bg-brass`, etc.
7. **Never add dark mode.** The design is committed light.
8. **Never display a kitchen's exact address.** It is RLS-gated on purpose and will return no rows for you. That is correct behaviour.

## Build order

Work in this sequence. Each step is useful on its own, and the first two need no database, so start there and you will never be blocked.

1. `lib/social/credibility.ts` — pure scoring functions. Formula and tier thresholds are specified exactly in README.md; implement them verbatim, since the demo narrates the numbers.
2. `lib/social/badges.ts` — the 13 badge definitions, split into computed vs granted.
3. `lib/social/credibility.test.ts` — vitest fixtures covering tier boundaries and the negative-penalty cases. Ask the human to run `npx vitest run`.
4. `components/social/kitchen-credibility-panel.tsx` — replace the stub. The most important surface in the app.
5. `components/social/kitchen-badge-shelf.tsx` — replace the stub.
6. `components/social/review-feed.tsx` — replace the stub.
7. `app/(social)/u/[handle]/page.tsx` — buyer profile: diary, stats, badges, rating histogram.
8. Review composer + `app/(social)/log/[id]/page.tsx`.
9. `app/(social)/k/[slug]/record/page.tsx` — the printable Business Record.

## Three stubs already exist

`components/social/*.tsx` contain placeholder implementations. **Replace their internals. Do not rename them, move them, or change their signatures** — a host-owned page imports them by exact path and will not be changed to accommodate you.

Each takes exactly one prop:

```ts
export async function KitchenCredibilityPanel({ kitchenId }: { kitchenId: string })
export async function KitchenBadgeShelf({ kitchenId }: { kitchenId: string })
export async function ReviewFeed({ kitchenId }: { kitchenId: string })
```

They are React Server Components. Each does its own Supabase query. Do not add props or lift state into the page.

## Conventions

Server Components by default; `"use client"` only where interactivity requires it, nested inside a server wrapper. Tailwind utilities only. `kebab-case.tsx` filenames, named exports. `cn()` from `@/lib/utils`. Money in integer cents; ratings stored 0–10, displayed 0–5 stars. Every screen must work at 390 px wide.

Read kitchen counters directly off the `kitchens` row — they are trigger-maintained.
Buyer counters come from the `buyer_counters` **view** (one row per profile, keyed by
`user_id`), not from `profiles`. Do not aggregate across `orders`, `logs`, or
`log_likes` at render time; both sources exist so you don't have to.

## If you are unsure

Ask the human rather than guessing, particularly about anything touching the database schema, the scoring formula, or a shared file. A wrong guess in a shared file costs the other agent's work, not just yours.
