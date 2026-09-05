# Dishd working agreement

The user owns the full project and explicitly replaced the local rebuild with Claude's latest GitHub main on 2026-09-05. **The active agent owns the whole project.** The historical Live Share host/guest restrictions in README and lib/social/HANDOFF.md are superseded. Codex and Claude alternate; do not run parallel agents or disturb another session.

Read README.md, HANDOFF.md, and DESIGN.md. Continue main, preserve history, commit and push about every ten minutes while actively working, and update HANDOFF.md at checkpoints. Never force-push, commit secrets, or restore the old rebuild over current main.

Keep a local preview on port 4173. Use the existing exact lockfile. Write focused changes, test relevant logic and browser flows, and state honestly when live service verification is unavailable.

All directories and migrations are in scope for the current user's request. Preserve server-side authentication, RLS, order provenance, receipt privacy, integer-cent money, and the exact credibility formulas. Spendable rewards are separate from credibility. Personal claims are never automatically verified. Community warnings must distinguish pending reports from confirmed enforcement.

Use the existing cream / forest / brass design tokens, a light palette, readable typography, breathing room, responsive 390px layouts, accessible forms, and reduced-motion support. DESIGN.md is the implementation contract for the next agent.

This Next.js version may differ from earlier versions. Read relevant installed guides under node_modules/next/dist/docs before changing framework behavior.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
