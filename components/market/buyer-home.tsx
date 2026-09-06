import Link from "next/link";
import { MapPinned, RotateCcw } from "lucide-react";
import type { KitchenPublic, ProfilePublic } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";
import { rankByDistance, resolveLocation } from "@/lib/market/nearby";
import { SiteHeader } from "@/components/market/site-header";
import { BuyerSummary } from "@/components/market/buyer-summary";
import { KitchenBrowser } from "@/components/market/kitchen-browser";
import { KitchenCard } from "@/components/market/kitchen-card";

/**
 * The home page for someone who is signed in.
 *
 * A signed-out visitor needs the pitch — what Dishd is and why the receipts
 * matter. Someone signed in has already bought it and wants to order, so the
 * hero is replaced by their own record and the kitchens move to the top.
 */
async function orderAgainKitchens(
  buyerId: string,
  kitchens: KitchenPublic[],
): Promise<KitchenPublic[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("orders")
    .select("kitchen_id, created_at")
    .eq("buyer_id", buyerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(40);

  const seen = new Set<string>();
  const ordered: KitchenPublic[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.kitchen_id)) continue;
    seen.add(row.kitchen_id);
    const kitchen = kitchens.find((k) => k.id === row.kitchen_id);
    if (kitchen) ordered.push(kitchen);
    if (ordered.length === 3) break;
  }
  return ordered;
}

export async function BuyerHome({
  profile,
  kitchens,
  near,
}: {
  profile: ProfilePublic;
  kitchens: KitchenPublic[];
  /** A town or ZIP typed into the location search, if any. */
  near?: string;
}) {
  const again = await orderAgainKitchens(profile.id, kitchens);

  // Someone signed in gets the same distance ranking as a first-time visitor.
  const location = near ? resolveLocation(near) : null;
  const ordered = location ? rankByDistance(kitchens, location.point) : kitchens;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <BuyerSummary profile={profile} />

        {again.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 font-display text-2xl text-forest sm:text-3xl">
              <RotateCcw className="h-5 w-5" aria-hidden />
              Order again
            </h2>
            <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {again.map((k) => (
                <li key={k.id}>
                  <KitchenCard kitchen={k} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-forest sm:text-3xl">
              {again.length > 0 ? "All kitchens" : "Kitchens near you"}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPinned className="h-3.5 w-3.5" aria-hidden />
              Approximate areas only until an order is accepted
            </p>
          </div>

          <div className="mt-5">
            {kitchens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-sunk p-12 text-center">
                <p className="text-ink-muted">
                  No kitchens are open near you yet.
                </p>
              </div>
            ) : (
              <KitchenBrowser kitchens={ordered} />
            )}
          </div>
        </section>

        <section className="mt-14 overflow-hidden rounded-2xl bg-forest px-6 py-10 sm:px-10">
          <h2 className="font-display text-2xl text-cream sm:text-3xl">
            Cooking already? Start selling.
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-cream/75">
            Dishd builds you a verifiable trading history — meals served, repeat
            customers, sourcing streak — the kind of record no bank has ever let
            a home cook prove.
          </p>
          <Link
            href="/cook"
            className="mt-5 inline-block rounded-full bg-cream px-6 py-3 text-sm font-medium text-forest hover:bg-white"
          >
            Set up your kitchen
          </Link>
        </section>
      </main>
    </>
  );
}
