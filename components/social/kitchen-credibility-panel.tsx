/**
 * STUB — owned by the guest workstream (Codex). Replace the internals.
 *
 * Do not rename, move, or change the signature: a host-owned page imports this
 * by exact path. See README.md -> "What the guest builds" for the spec.
 *
 * Should render: tier, score, the full ScoreComponent breakdown, and distance
 * to the next tier. This is the most important surface in the app.
 */
export async function KitchenCredibilityPanel({ kitchenId }: { kitchenId: string }) {
  return (
    <section
      data-stub="kitchen-credibility-panel"
      data-kitchen-id={kitchenId}
      className="rounded-lg border border-line bg-surface-sunk p-4 text-sm text-ink-muted"
    >
      Credibility panel — not built yet.
    </section>
  );
}
