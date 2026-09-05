# Dishd — working agreement

The user requested a complete rebuild on 2026-09-05. This file supersedes the old Live Share / host / guest rules preserved in PRODUCT_BRIEF.md and lib/social/HANDOFF.md.

## One active agent, the whole project

Codex and Claude now work **in sequence**, alternating when the user switches tools or runs out of credits. The active agent owns the entire website. There are no frozen directories or separate workstreams. Do not start parallel agents or change another running coding session.

Read README.md and HANDOFF.md at the start. PRODUCT_BRIEF.md preserves product requirements and the original scoring formulas; its old ownership and terminal restrictions are historical.

## Small, testable milestones

- Keep a working local preview at http://localhost:4173. It must work without secrets or backend setup in demo mode.
- Build one coherent milestone, verify it, give the user a short testing checklist, and pause for feedback before the next milestone.
- The user should always be able to run npm install, then npm run dev. scripts/start-preview.ps1 also supports the existing VS Code runtime on Windows when Node is not installed.
- Keep clearly labelled sample kitchens and simulated flows separate from real transactions. Never claim a demo order, receipt, review, or payment is verified by a live service.
- Preserve the cream / forest / brass palette. Aim for editorial food discovery plus social meal diaries: Letterboxd meets Uber Eats. Responsive at 390px. Accessible controls and reduced-motion support.

## Commits and alternating agents

- Working branch: codex/rebuild. GitHub repository: https://github.com/Tahsan228/Dishd.
- Commit and push reviewable progress about every 10 minutes while actively working, and at the end of each milestone. Do not create empty commits just for the timer.
- Update HANDOFF.md with each checkpoint: what works, what was checked, known gaps, preview command, and the next bounded task.
- Claude: fetch and continue the latest pushed codex/rebuild commit. Do not restore the old application or restart from the old main branch. Codex follows the same rule when returning.
- Preserve Git history. Do not force-push. Do not commit credentials, .env files, node_modules, preview logs, or build outputs.

## Product rules to carry forward

Completed pickups create verified meal logs. Business credibility belongs to the kitchen. Keep the exact scoring formulas and badge thresholds from PRODUCT_BRIEF.md when implementing those milestones. Exact home addresses must never appear in public discovery, profiles, or feeds. Sourcing pending human review must not appear as verified. Money uses integer cents; stored ratings use 0–10 and display as 0–5 stars.
