/**
 * STUB — owned by the guest workstream (Codex). Replace the internals.
 *
 * Do not rename, move, or change the signature. See README.md for the badge
 * spec: 10 computed badges derived from counters, 3 granted badges read from
 * the kitchen_badges table.
 */
export async function KitchenBadgeShelf({ kitchenId }: { kitchenId: string }) {
  return (
    <section
      data-stub="kitchen-badge-shelf"
      data-kitchen-id={kitchenId}
      className="rounded-lg border border-line bg-surface-sunk p-4 text-sm text-ink-muted"
    >
      Badge shelf — not built yet.
    </section>
  );
}
