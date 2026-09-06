import Image from "next/image";
import Link from "next/link";
import { CookingPot, ChevronDown } from "lucide-react";
import { currentProfile, signOut } from "@/lib/market/auth-actions";
import { createServerClient } from "@/lib/supabase/server";
import { CartButton } from "@/components/market/cart-button";

export async function SiteHeader() {
  const profile = await currentProfile();

  // Cooks get a link straight to their dashboard.
  let ownsKitchen = false;
  if (profile) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("kitchens")
        .select("id")
        .eq("owner_id", profile.id)
        .maybeSingle();
      ownsKitchen = Boolean(data);
    } catch {
      ownsKitchen = false;
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Dishd home" className="flex shrink-0 items-center gap-2.5">
          {/* Bare forest pot, no disc — it sits directly on the cream header
              beside the wordmark. aria-hidden because the adjacent logo already
              carries the name. */}
          <CookingPot
            aria-hidden
            className="h-6 w-6 shrink-0 text-forest sm:h-7 sm:w-7"
          />
          <Image
            src="/logos/GreenLogo-trimmed.png"
            alt="Dishd"
            width={911}
            height={216}
            priority
            className="h-6 w-auto sm:h-7"
          />
        </Link>

        <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-2 text-sm">
          <CartButton />
          {profile ? (
            <>
              {/* The personal diary is the social half of the product; without
                  a link here it was only reachable from an order. */}
              <Link
                href="/community"
                className="hidden rounded-full px-3 py-2 text-ink-muted hover:text-forest lg:inline-block"
              >
                Community
              </Link>
              <Link
                href="/orders"
                className="hidden rounded-full px-3 py-2 text-ink-muted hover:text-forest lg:inline-block"
              >
                Orders
              </Link>
              <Link
                href="/rewards"
                className="hidden rounded-full px-3 py-2 text-ink-muted hover:text-forest lg:inline-block"
              >
                Points
              </Link>
              <Link
                href="/diary"
                className="hidden rounded-full px-3 py-2 text-ink-muted hover:text-forest lg:inline-block"
              >
                Diary
              </Link>
              <Link
                href="/cook"
                className="hidden rounded-full bg-forest px-4 py-2 font-medium text-cream hover:bg-forest-deep lg:inline-block"
              >
                {ownsKitchen ? "My kitchen" : "Start selling"}
              </Link>
              <details className="relative min-w-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-forest/20 bg-forest-soft px-3 py-2 text-forest">
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-sm font-semibold text-cream">{profile.display_name.charAt(0)}</span>
                  <span className="min-w-0"><strong className="block max-w-20 truncate text-sm sm:max-w-32">{profile.display_name.split(" ")[0]}</strong><span className="block text-[11px] text-ink-muted">Your account</span></span>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
                </summary>
                <div className="absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-lg">
                  <p className="border-b border-line px-3 pb-3 pt-1 text-sm font-semibold text-forest">{profile.display_name}<span className="mt-1 block text-xs font-normal text-ink-muted">@{profile.handle}</span></p>
                  {[["/u/" + profile.handle, "Your profile"], ["/orders", "Your orders"], ["/rewards", "Neighborhood Points"], ["/community", "Community"], ["/diary", "Your diary"], ["/cook", ownsKitchen ? "My kitchen" : "Start selling"]].map(([href,label]) => <Link key={href} href={href} className="block min-h-11 rounded-xl px-3 py-3 text-sm text-forest hover:bg-forest-soft">{label}</Link>)}
                  {ownsKitchen && <Link href="/cook/discovery" className="block min-h-11 rounded-xl px-3 py-3 text-sm text-forest hover:bg-forest-soft">Discovery &amp; offers</Link>}
                  <form action={signOut} className="border-t border-line"><button type="submit" className="min-h-11 w-full rounded-xl px-3 py-3 text-left text-sm text-ink-muted hover:bg-surface-sunk">Sign out</button></form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-full border border-line px-4 py-2 text-ink-muted hover:border-forest hover:text-forest"
              >
                Sign in
              </Link>
              <Link
                href="/cook"
                className="rounded-full bg-forest px-4 py-2 font-medium text-cream hover:bg-forest-deep"
              >
                Start selling
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
