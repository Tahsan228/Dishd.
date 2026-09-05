import { SiteFooter } from "@/components/market/site-footer";

/**
 * Marketplace shell.
 *
 * Exists so the standing disclosure and the legal links appear on every
 * marketplace page without touching the shared root layout. The social routes
 * carry their own layout.
 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
  );
}
