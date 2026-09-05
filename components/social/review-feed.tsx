/**
 * STUB — owned by the guest workstream (Codex). Replace the internals.
 *
 * Do not rename, move, or change the signature. Renders LogWithAuthor rows for
 * this kitchen, newest first. Verified logs (backed by a completed order) get a
 * visible mark; unverified logs render in a visibly lesser treatment.
 */
export async function ReviewFeed({ kitchenId }: { kitchenId: string }) {
  return (
    <section
      data-stub="review-feed"
      data-kitchen-id={kitchenId}
      className="rounded-lg border border-line bg-surface-sunk p-4 text-sm text-ink-muted"
    >
      Review feed — not built yet.
    </section>
  );
}
