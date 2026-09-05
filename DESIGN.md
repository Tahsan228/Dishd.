# Dishd design contract

Keep the same identity throughout the app: warm cream ground, deep forest green actions, brass earned rewards, clay problems, amber pending reviews. Existing Tailwind theme tokens in app/globals.css are the source of truth. Never add dark mode or a second green.

The user wants a cleaner, more readable version of this theme. The top-left logo should be compact. Use generous section spacing and card padding, comfortable line height, and normal UI letter spacing. Reserve the display face for page and major section headings; small card titles, form labels, and navigation should use the readable sans face. Avoid tiny body text and crowded navigation.

Food discovery should be easy to scan; community should feel like a personal food diary with rich review cards, visible authors, clear ratings, and connected kitchen links. Rewards use brass to represent something earned. Keep moderation states and demo labels explicit.

Motion should support hierarchy: subtle entrance, gentle card lift, clear button feedback. Honor prefers-reduced-motion. All screens must fit 390px with readable controls and no horizontal page overflow.

Claude: follow these tokens and the actual shared components rather than introducing a separate visual system. The latest GitHub main is the baseline; do not copy the superseded codex/rebuild interface over it.
