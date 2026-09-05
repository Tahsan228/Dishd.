# Claude handoff — read this first

@AGENTS.md

The workflow has changed at the user's explicit request. **Codex and Claude alternate; they no longer own separate parts or work concurrently.** Whichever agent the user starts next owns the entire project and continues the latest committed milestone.

1. Read HANDOFF.md and README.md.
2. Fetch and use the latest codex/rebuild branch from https://github.com/Tahsan228/Dishd.
3. Keep the preview running at http://localhost:4173. Demo mode needs no service credentials.
4. Build one small part at a time, run its checks, commit/push about every 10 minutes while working, and update HANDOFF.md in the same checkpoint.
5. Ask the user to test each completed part before advancing. Continue from their feedback.

Latest user direction: the app needs separate pages. After login, open a new home page with a profile summary and **View full profile** button above the Uber Eats-style marketplace. Full profiles, kitchen/meal details, checkout, customer orders, and cook management must be distinct navigable pages with connected, functioning flows. See HANDOFF.md for the proposed routes and the current explicit pause; do not resume feature work until the user says to continue.

The old implementation was intentionally removed. PRODUCT_BRIEF.md is retained for product/domain requirements; old host/guest limitations in that archive no longer apply. Do not merge old application code back in merely to recover the previous structure.
