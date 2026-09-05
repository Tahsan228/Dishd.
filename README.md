# Dishd

Good food. Closer to home.

Dishd brings together **halal home-kitchen discovery and ordering** with **meal diaries, ratings, and community**. Think the browsing clarity of Uber Eats and the personal food history of Letterboxd, in an editorial cream, forest-green, and brass visual identity.

## Run the preview

```sh
npm install
npm run dev
```

Open **http://localhost:4173**. The initial milestones use clearly identified sample kitchens and local browser state, so you can test without accounts, API keys, or a database.

Windows without standalone Node: run `powershell -ExecutionPolicy Bypass -File scripts/start-preview.ps1`. It uses an installed Node runtime or VS Code's bundled runtime, and writes logs to the ignored `.preview/` folder.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Production builds use `.next-build/`; development uses `.next/`. Building does not overwrite the running preview. `npm start` serves the production build on port 4173 after the development server is stopped.

Photo provenance and bundled font licenses are documented in [ASSETS.md](ASSETS.md).

## Build in parts

1. **Discovery and visual foundation** — responsive homepage, food photography, cuisine/search filters, sorting, saved kitchens, kitchen preview, and a community feed.
2. **Login, home, and profile pages** — login leads to a separate signed-in home page, with a profile summary and “View full profile” button above the Uber Eats-style marketplace. Full profile has its own page.
3. **Kitchen and meal pages** — dedicated URLs, full menus, sourcing evidence, kitchen story, pickup availability.
4. **Checkout and customer orders** — connected basket, pickup selection, totals, checkout, order list, and individual order-status pages, with state retained across refresh.
5. **Cook management** — dedicated dashboard, editable menus/availability, and incoming order handling connected to the customer's order lifecycle.
6. **Meal diaries and credibility** — ratings, reviews, verified pickup linkage, badges, profile history, transparent kitchen scoring, and printable Business Record.
7. **Live services** — real authentication, database/RLS, storage, order lifecycle and payments, without breaking the demo preview. Simulated services remain explicitly labelled until connected.

Each part ends with a commit and a short checklist for the user to test. Current status and exact next steps live in **[HANDOFF.md](HANDOFF.md)**.

## Working agreement

One agent owns the whole project at a time. The user alternates between Codex and Claude as credits allow. Both continue the latest pushed **codex/rebuild** branch, commit progress about every 10 minutes while active, and update the handoff. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

The earlier code was intentionally replaced at the user's request. [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) preserves the original Markdown product brief, including exact credibility formulas and badge thresholds. Its previous parallel-agent workflow is superseded.
