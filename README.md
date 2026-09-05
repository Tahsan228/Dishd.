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

## Build in parts

1. **Discovery and visual foundation** — responsive homepage, food photography, cuisine/search filters, sorting, saved kitchens, kitchen preview, and a community feed.
2. **Kitchen and meal pages** — full menus, sourcing evidence, kitchen story, pickup availability.
3. **Order flow** — basket, pickup selection, order status, and clearly simulated demo checkout.
4. **Meal diaries and credibility** — ratings, reviews, verified pickup linkage, badges, buyer profiles, and transparent kitchen scoring.
5. **Cook tools and Business Record** — menus, sourcing submissions, order management, printable trading history.
6. **Live services** — real authentication, database/RLS, storage, order lifecycle and payments, without breaking the demo preview.

Each part ends with a commit and a short checklist for the user to test. Current status and exact next steps live in **[HANDOFF.md](HANDOFF.md)**.

## Working agreement

One agent owns the whole project at a time. The user alternates between Codex and Claude as credits allow. Both continue the latest pushed **codex/rebuild** branch, commit progress about every 10 minutes while active, and update the handoff. See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

The earlier code was intentionally replaced at the user's request. [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) preserves the original Markdown product brief, including exact credibility formulas and badge thresholds. Its previous parallel-agent workflow is superseded.
