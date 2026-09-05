import Image from "next/image";
import Link from "next/link";
import { currentProfile, signOut } from "@/lib/market/auth-actions";
import { createServerClient } from "@/lib/supabase/server";

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
        <Link href="/" aria-label="Dishd home" className="shrink-0">
          <Image
            src="/logos/PaleBackgroundGreenText-trimmed.png"
            alt="Dishd"
            width={911}
            height={216}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {profile ? (
            <>
              <span className="hidden text-ink-muted sm:inline">{profile.display_name}</span>
              <Link
                href="/cook"
                className="rounded-full bg-forest px-4 py-2 font-medium text-cream hover:bg-forest-deep"
              >
                {ownsKitchen ? "My kitchen" : "Start selling"}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-line px-3 py-2 text-ink-muted hover:border-forest hover:text-forest"
                >
                  Sign out
                </button>
              </form>
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
