import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Flame, Utensils } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { MenuItemForm } from "@/components/market/cook-onboarding-forms";
import { MenuAvailabilityToggle } from "@/components/market/menu-availability-toggle";
import { DeleteDishButton } from "@/components/market/kitchen-controls";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Your menu · Dishd" };

/**
 * Menu management for a kitchen that is already open.
 *
 * This page exists because /cook/start redirects a live kitchen straight back
 * to /cook — so "Add a dish" bounced off the onboarding flow and an open
 * kitchen could never list anything new. Onboarding is for getting open; this
 * is for running.
 */
export default async function CookMenuPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=%2Fcook%2Fmenu");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fmenu");

  const { data: kitchen } = await supabase
    .from("kitchens")
    .select("id, name, slug, status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!kitchen) redirect("/cook");

  const [menuResult, batchResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, name, price_cents, is_available, contains_meat, calories, portion_size, photo_url")
      .eq("kitchen_id", kitchen.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("sourcing_batches")
      .select("id, ocr_store, ocr_date, match_status")
      .eq("kitchen_id", kitchen.id)
      .eq("match_status", "verified")
      .order("created_at", { ascending: false }),
  ]);

  const menu = menuResult.data ?? [];
  // Only verified batches can back a meat dish, so only those are offered.
  const batches = (batchResult.data ?? []).map((b) => ({
    id: b.id as string,
    label: `${b.ocr_store ?? "Receipt"} · ${b.ocr_date ?? "undated"}`,
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link
          href="/cook"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-forest underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to your kitchen
        </Link>

        <h1 className="mt-2 font-display text-3xl text-forest sm:text-4xl">Your menu</h1>
        <p className="mt-2 leading-relaxed text-ink-muted">
          What buyers can order from{" "}
          <Link href={`/k/${kitchen.slug}`} className="text-forest underline underline-offset-2">
            {kitchen.name}
          </Link>
          . Calories and ingredients you enter are shown on the public menu as
          your own declaration.
        </p>

        <h2 className="mt-10 flex items-center gap-2 font-display text-2xl text-forest">
          <Utensils className="h-5 w-5" aria-hidden />
          Dishes{" "}
          {menu.length > 0 && <span className="tabular text-base text-ink-muted">({menu.length})</span>}
        </h2>

        {menu.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface-sunk p-8 text-center text-sm text-ink-muted">
            Nothing listed yet. Add your first dish below.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {menu.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3.5">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-sunk">
                  {item.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                    <span>{formatCents(item.price_cents)}</span>
                    {item.portion_size && <span>· {item.portion_size}</span>}
                    {item.calories !== null && (
                      <span className="flex items-center gap-1">
                        · <Flame className="h-3 w-3" aria-hidden />
                        {item.calories} kcal
                      </span>
                    )}
                    {item.contains_meat && <span>· contains meat</span>}
                  </p>
                </div>

                <MenuAvailabilityToggle
                  itemId={item.id}
                  name={item.name}
                  available={item.is_available}
                />
                <DeleteDishButton itemId={item.id} name={item.name} />
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 font-display text-2xl text-forest">Add a dish</h2>
        {batches.length === 0 && (
          <p className="mt-2 rounded-xl border border-amber/30 bg-amber/10 p-4 text-xs leading-relaxed text-ink">
            You have no verified sourcing receipt on file, so a meat dish cannot
            go on sale yet. Vegetarian dishes are fine.{" "}
            <Link href="/cook/start" className="underline underline-offset-2">
              Upload a receipt
            </Link>
            .
          </p>
        )}
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <MenuItemForm batches={batches} />
        </div>
      </main>
    </>
  );
}
