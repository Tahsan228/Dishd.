import { ShieldCheck, Clock, TriangleAlert, Info, Flame, Utensils, Star } from "lucide-react";
import { getDishRatingSummaries } from "@/lib/market/dish-ratings";
import { getKitchenMenu, type MenuItemWithProvenance } from "@/lib/market/kitchens";
import { AddToCart } from "@/components/market/add-to-cart";
import { formatCents } from "@/lib/utils";

const ALLERGEN_LABEL: Record<string, string> = {
  none_declared: "None declared",
  gluten: "Gluten",
  dairy: "Dairy",
  tree_nuts: "Tree nuts",
  peanuts: "Peanuts",
  sesame: "Sesame",
  mustard: "Mustard",
  egg: "Egg",
  soy: "Soy",
  fish: "Fish",
  shellfish: "Shellfish",
};

/**
 * The Chain of Trust surface.
 *
 * Every claim here is attributed to the cook, never to Dishd — the badge says
 * what was checked and who said it. A <details> element carries the full
 * provenance so the sheet needs no client JavaScript.
 */
function Provenance({
  batch,
}: {
  batch: NonNullable<Awaited<ReturnType<typeof getKitchenMenu>>[number]["sourcing_batches"]>;
}) {
  const store = batch.halal_sources?.store_name ?? batch.ocr_store ?? "Undisclosed supplier";
  const cert = batch.halal_sources?.cert_body;

  if (batch.match_status === "verified") {
    return (
      <details className="mt-3 rounded-lg border border-forest/20 bg-forest-soft/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-2.5 text-xs font-medium text-forest">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {store}
            {batch.ocr_date && ` · receipt verified ${batch.ocr_date}`}
          </span>
        </summary>
        <div className="space-y-2 border-t border-forest/15 p-3 text-xs text-ink-muted">
          <dl className="space-y-1">
            <div className="flex justify-between gap-4">
              <dt>Supplier</dt>
              <dd className="text-right font-medium text-ink">{store}</dd>
            </div>
            {cert && (
              <div className="flex justify-between gap-4">
                <dt>Certifying body</dt>
                <dd className="text-right font-medium text-ink">{cert}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt>Purchase receipt</dt>
              <dd className="text-right font-medium text-ink">On file, checked</dd>
            </div>
          </dl>
          <p className="border-t border-line pt-2 leading-relaxed">
            Sourcing information is self-reported by the cook and checked against
            receipts they upload. Dishd does not certify any food as halal.
          </p>
        </div>
      </details>
    );
  }

  if (batch.match_status === "pending") {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 p-2.5 text-xs font-medium text-amber">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        Sourcing receipt sent for review
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg border border-clay/30 bg-clay/10 p-2.5 text-xs font-medium text-clay">
      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
      Sourcing could not be verified
    </p>
  );
}

/**
 * A dish is orderable when it is available and, if it contains meat, backed by
 * a receipt that has cleared review. Same rule the kitchen page applies before
 * offering the order panel, and `placeOrder` re-checks it server-side.
 */
function orderable(item: MenuItemWithProvenance): boolean {
  if (!item.is_available) return false;
  return !item.contains_meat || item.sourcing_batches?.match_status === "verified";
}

export async function MenuGrid({
  kitchen,
}: {
  kitchen: { id: string; name: string; slug: string };
}) {
  const items = await getKitchenMenu(kitchen.id);
  const ratings = await getDishRatingSummaries(items.map(item => item.id));

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface-sunk p-6 text-center text-sm text-ink-muted">
        This kitchen hasn&apos;t listed anything yet.
      </p>
    );
  }

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          id={`dish-${item.id}`}
          className="lift flex scroll-mt-32 flex-col overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div className="aspect-[16/10] overflow-hidden bg-surface-sunk">
            {item.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg leading-tight text-forest">{item.name}</h3>
              <span className="tabular shrink-0 font-medium text-ink">
                {formatCents(item.price_cents)}
              </span>
            </div>

            {item.description && (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.description}</p>
            )}

            <p className="mt-2 flex items-center gap-1.5 text-sm text-forest">
              <Star className="h-4 w-4 text-brass" aria-hidden />
              {ratings.get(item.id)?.rating_count
                ? `${(ratings.get(item.id)!.avg_rating_10 / 2).toFixed(1)} · ${ratings.get(item.id)!.rating_count} dish ratings`
                : "No dish ratings yet"}
            </p>

            {(item.portion_size || item.calories !== null) && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                {item.portion_size && (
                  <span className="flex items-center gap-1">
                    <Utensils className="h-3.5 w-3.5" aria-hidden />
                    {item.portion_size}
                  </span>
                )}
                {item.calories !== null && (
                  <span className="tabular flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" aria-hidden />
                    {item.calories} kcal
                  </span>
                )}
              </p>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Allergens:{" "}
                {item.allergens.map((a) => ALLERGEN_LABEL[a] ?? a).join(", ")}
              </span>
            </p>

            {/* The cook's own words. Attributed, and never presented as
                anything Dishd measured — a calorie count we invented sitting
                beside a real allergen list would be the most dangerous thing
                on this page. */}
            {item.ingredients && (
              <details className="mt-2 rounded-lg border border-line bg-surface-sunk">
                <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-ink">
                  Ingredients, as listed by the cook
                </summary>
                <p className="border-t border-line px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
                  {item.ingredients}
                  <span className="mt-1.5 block text-[11px]">
                    Declared by the cook. Dishd does not verify ingredients or
                    calculate calories.
                  </span>
                </p>
              </details>
            )}

            {item.contains_meat && item.sourcing_batches && (
              <Provenance batch={item.sourcing_batches} />
            )}

            {/* Pushed to the bottom so cards with different amounts of
                provenance still line their buttons up. */}
            <div className="mt-auto">
              <AddToCart
                kitchen={kitchen}
                item={{ id: item.id, name: item.name, priceCents: item.price_cents }}
                disabled={!orderable(item)}
                disabledReason={
                  !item.is_available
                    ? "Sold out for today."
                    : "Awaiting receipt review — this dish cannot be ordered yet."
                }
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
