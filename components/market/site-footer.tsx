import Link from "next/link";

/**
 * The standing disclosure.
 *
 * The home-kitchen and halal statements are made at order time too, but they
 * belong on every page: someone browsing a menu is forming an impression long
 * before they reach a checkbox.
 */
export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-surface-sunk">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <p className="max-w-2xl text-xs leading-relaxed text-ink-muted">
          Dishd lists home kitchens and takes pickup orders for them. The cook is
          the seller. Food here is prepared in private homes that are not
          routinely inspected by a health department, and{" "}
          <strong className="font-medium text-ink">
            Dishd does not certify any food as halal
          </strong>{" "}
          — sourcing claims are made by the cook and evidenced by receipts.
        </p>

        <nav
          aria-label="Footer"
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
        >
          <Link href="/legal" className="text-ink-muted hover:text-forest">Legal</Link>
          <Link href="/legal/terms" className="text-ink-muted hover:text-forest">Terms of use</Link>
          <Link href="/legal/privacy" className="text-ink-muted hover:text-forest">Privacy</Link>
          <Link href="/diary" className="text-ink-muted hover:text-forest">Your diary</Link>
          <Link href="/cook" className="text-ink-muted hover:text-forest">Start selling</Link>
        </nav>
      </div>
    </footer>
  );
}
