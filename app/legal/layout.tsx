import Link from "next/link";
import { SiteHeader } from "@/components/market/site-header";
import { ACK_VERSION } from "@/lib/market/order-consent";

/**
 * Shared shell for the legal documents.
 *
 * These pages exist because the order flow already records consent against a
 * document version, and asks buyers to accept three statements about home
 * kitchens, allergens and halal sourcing. Recording agreement to documents that
 * a person could not read was the gap.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <Link href="/legal" className="hover:text-forest">Overview</Link>
          <Link href="/legal/terms" className="hover:text-forest">Terms of use</Link>
          <Link href="/legal/privacy" className="hover:text-forest">Privacy</Link>
        </nav>

        <div className="prose-dishd mt-6 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-forest [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:leading-relaxed [&_ul]:text-ink">
          {children}
        </div>

        <p className="mt-10 border-t border-line pt-4 text-xs text-ink-muted">
          Order acknowledgments in force: version{" "}
          <span className="tabular">{ACK_VERSION}</span>. Each acceptance is
          recorded against the version that was in force at the time.
        </p>
      </main>
    </>
  );
}
