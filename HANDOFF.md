# Current handoff

## Status — paused by user; milestone 1 ready for review

Updated 2026-09-05. Working branch: **codex/rebuild**, repository https://github.com/Tahsan228/Dishd.

**The user explicitly paused feature work. Save this checkpoint and wait for them to resume.** Codex and Claude work in sequence, with full-project ownership; the old host/guest split is retired. Read AGENTS.md and CLAUDE.md.

## Latest user direction — separate pages and complete flows

The current discovery page is only the public entry point. The user requires distinct navigable pages, not an entire app inside homepage dialogs:

- `/login`: authentication. Successful login opens `/home`.
- `/home`: a compact summary of the signed-in user's profile, a **View full profile** button, then an Uber Eats-style marketplace below it.
- `/profile`: the full personal profile, meal history/diary, and credibility details; public profiles can use `/profiles/[id]`.
- `/kitchens/[slug]` and `/meals/[id]`: dedicated kitchen and meal pages.
- `/checkout`: a working basket, pickup choice, order totals, and checkout flow.
- `/orders` and `/orders/[id]`: the customer's order list and order status/detail pages.
- `/dashboard`, `/dashboard/menu`, and `/dashboard/orders`: cook/kitchen management, editable offerings and availability, and order handling.

Route names are proposed implementation choices; the separate pages and post-login layout are explicit user requirements. Ordering and management must work end to end, with state carried between customer and cook views and retained across refresh. Do not present static buttons or unrelated mock screens as completed functionality. Keep simulated payments and demo authentication clearly identified until real services are integrated. Test the complete customer-to-cook lifecycle before claiming those milestones finished.

## What works

- Rebuilt the application from the preserved Markdown requirements. All old non-Markdown project files were removed in this branch; Git history was retained. PRODUCT_BRIEF.md preserves the original README.
- Responsive cream / forest / brass discovery page with local editorial food photography, Fraunces headings, DM Sans interface text, and mobile navigation.
- Six clearly fictional kitchens. Search dishes, cooks, cuisines, or neighborhoods; combine cuisine, Oakland/Berkeley location, pickup-today, and price filters; sort by rating, distance, or meal price.
- Kitchen dialogs show the cook's story, neighborhood, sample pickup times, and menu. Keyboard Escape closes the dialog and focus returns to its trigger.
- Hearts save kitchens on the current device. Saved collection, refresh persistence, empty states, invalid saved data, cross-tab storage events, and blocked-storage fallback are handled.
- Sample community meal diary cards open the associated kitchen.
- Money uses integer cents. Kitchen aggregate ratings use the 0–10 scale and display as 0–5 stars. Meal prices exclude drinks, desserts, and sauces marked as extras. Bakery items are food offerings.
- Assets and complete font licenses are local; see ASSETS.md for provenance and the image generation prompt.

## Preview and checkout

Open **http://localhost:4173**. The development server is running and should be left running.

Current working folder on this Windows machine:
`C:\Users\kayde\AppData\Roaming\Code\User\workspaceStorage\dea8cb79577edc0daf0c5bf5bacb1973\openai.chatgpt\virtual-workspaces\7a31d1becf2ce13d\dishd-rebuild`

The neighboring `dishd` checkout is the earlier session, not this rebuild. Continue in `dishd-rebuild` or fetch `origin/codex/rebuild` into your own clone. Do not restore the old main branch.

With Node installed: `npm install`, then `npm run dev`.
On this machine without Node on PATH: `powershell -ExecutionPolicy Bypass -File scripts/start-preview.ps1` uses VS Code's bundled Node runtime. Dependencies are installed.

Production output uses `.next-build/`; development uses `.next/`, so building does not overwrite the live preview. Both output folders and `.preview/` logs/screenshots are ignored.

## Validation completed

- Eight Vitest tests passed: dish search, combined filters, empty/clear results, main versus extra pricing, saved IDs, stable rating sorting, price/distance sorting, cents formatting.
- ESLint passed. Generated production output is excluded.
- TypeScript passed independently and in the final production build.
- Final optimized Next.js production build passed.
- Real Chrome checks: 23 passed, including search keyboard shortcut, search/cuisine/pickup filters, save/unsave, refresh persistence, empty collection, modal menu and Escape/focus restoration, corrupt/removed/blocked storage, mobile navigation, reduced motion, and no horizontal overflow at 390, 768, 1024, and 1440 pixels.
- Desktop and 390px screenshots inspected; all image assets loaded and no runtime exceptions were recorded.
- Temporary browser helpers/screenshots live under ignored `.preview/`; the test browser uses its own isolated profile and is closed after validation. The preview server remains running.

Run standard checks with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
For this machine's bundled runtime, set `ELECTRON_RUN_AS_NODE=1` and invoke the relevant CLI file using `C:\Users\kayde\AppData\Local\Programs\Microsoft VS Code\Code.exe`: `node_modules/typescript/bin/tsc --noEmit`, `node_modules/eslint/bin/eslint.js .`, `node_modules/vitest/vitest.mjs run`, or `node_modules/next/dist/bin/next build`. In PowerShell pipe output through `Out-String` to wait for completion.

## User test checklist

1. Open the preview and try the layout at phone width.
2. Search “biryani”; try cuisine, area, pickup, and price filters.
3. Heart a kitchen, open Saved, refresh, then unsave it.
4. Open a kitchen and inspect its menu. Close with the X or Escape.
5. Open a kitchen from a community diary card.

## Known limits and next bounded task

This is a browsing demo. No real businesses, sourcing verification, accounts, orders, payments, review creation, scoring engine, or database is connected. Pickup times, distances, ratings, badges, and stories are fictional. Exact home addresses are not exposed.

When the user resumes, build **part 2: login and the separate signed-in home/profile pages**, using the required profile-summary-above-marketplace layout. Then proceed to dedicated kitchen/meal pages and the connected checkout, customer orders, and cook-management flows in small, testable milestones. Preserve the current discovery experience and saved collection. Keep demo mode usable without credentials. Re-read the scoring and trust requirements in PRODUCT_BRIEF.md when implementing their later milestones.

Commit and push about every 10 minutes while actively working and at the end of each milestone. Update this file in the same checkpoint. Never force-push or merge the old implementation back into the rebuild.
