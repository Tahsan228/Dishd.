import Link from "next/link";
import { MapPin, Star, Utensils } from "lucide-react";
import type { DiscoveryDish, DiscoveryKitchen } from "@/lib/market/discovery";
import { travelEstimate } from "@/lib/market/discovery";
import { formatCents } from "@/lib/utils";

export function DiscoveryDishCard({ dish, kitchen, miles, offer = false }: { dish: DiscoveryDish; kitchen: DiscoveryKitchen; miles: number | null; offer?: boolean }) {
  return <Link href={`/k/${kitchen.slug}#dish-${dish.id}`} className="lift group block h-full overflow-hidden rounded-2xl border border-line bg-surface hover:border-forest/30">
    <div className="relative aspect-[16/10] overflow-hidden bg-surface-sunk">
      {dish.photo_url || kitchen.hero_url ? <>{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={dish.photo_url ?? kitchen.hero_url!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /></> : <Utensils className="m-auto h-full w-12 text-forest/30" aria-hidden />}
      <span className="absolute bottom-3 left-3 rounded-full bg-cream px-3 py-1 text-sm font-semibold text-forest">{formatCents(dish.price_cents)}</span>
    </div>
    <div className="p-4">
      {offer && dish.offer_title && <p className="mb-3 rounded-lg bg-brass/10 px-3 py-2 text-sm font-medium text-brass-ink">{dish.offer_title}</p>}
      <h3 className="font-sans text-lg font-semibold leading-snug text-forest">{dish.name}</h3>
      <p className="mt-1 truncate text-sm text-ink-muted">{kitchen.name}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {dish.rating_count > 0 ? <span className="inline-flex items-center gap-1 text-ink"><Star className="h-4 w-4 fill-brass text-brass" aria-hidden />{(dish.avg_rating_10 / 2).toFixed(1)} <span className="text-ink-muted">({dish.rating_count} dish ratings)</span></span> : <span className="text-ink-muted">Not rated yet</span>}
        {dish.serves > 1 && <span className="rounded-full bg-forest-soft px-2 py-1 text-forest">Serves {dish.serves}</span>}
      </div>
      {miles !== null && <p className="mt-3 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />~{miles.toFixed(1)} mi · {travelEstimate(miles)}</p>}
    </div>
  </Link>;
}
