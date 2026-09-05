# Current handoff

## Active work

Full rebuild, milestone 1: discovery and visual foundation. Branch: codex/rebuild.

The user now assigns the whole website to one agent at a time and alternates between Codex and Claude. Read AGENTS.md; the old host/guest split is retired.

## Current checkpoint

- Original non-Markdown application files were removed in a fresh checkout; Git history and all project Markdown were preserved.
- Original README retained as PRODUCT_BRIEF.md. README, AGENTS, and CLAUDE now describe the sequential workflow.
- New Next.js / React / TypeScript foundation. Preview is running at http://localhost:4173.
- Discovery UI now includes six sample kitchens, local food photos/fonts, search, cuisine/area/price/pickup filters, sorting, saved kitchens persisted on the device, kitchen menu dialogs, and a sample community feed.
- TypeScript check passed and homepage returned HTTP 200. Browser interaction checks, responsive visual review, and production build are the next verification steps. Milestone 1 is not yet signed off.

## Next agent

Finish and verify milestone 1, update this file with real check results, then ask the user to test it. Do not begin ordering or live backend integration before that feedback.
