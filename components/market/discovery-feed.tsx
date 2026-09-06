"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowRight, LocateFixed, MapPin, Map, List, Search, SlidersHorizontal, Users, Sparkles, Gift } from "lucide-react";
import { DISCOVERY_FILTERS, dishAvailable, hasOffer, kitchenDistance, matchesDiscovery, recommendationScore, type DiscoveryDish, type DiscoveryFilter, type DiscoveryKitchen } from "@/lib/market/discovery";
import { resolveLocation, type ResolvedLocation } from "@/lib/market/nearby";
import { KitchenCard } from "@/components/market/kitchen-card";
import { DiscoveryDishCard } from "@/components/market/discovery-dish-card";
import { DemoVideos } from "@/components/market/demo-videos";
import { cn } from "@/lib/utils";

const NearbyMap = dynamic(() => import("@/components/market/nearby-map"), { ssr: false, loading: () => <p role="status" className="mt-5 rounded-2xl bg-forest-soft p-8 text-sm">Loading the neighborhood map…</p> });
type Props = { kitchens: DiscoveryKitchen[]; dishes: DiscoveryDish[]; visited: string[]; initialLocation: ResolvedLocation; today: string; now: number; unavailable: boolean };
export function DiscoveryFeed({ kitchens, dishes, visited, initialLocation, today, now, unavailable }: Props) {
  const [location, setLocation] = useState(initialLocation);
  const [locationText, setLocationText] = useState(initialLocation.matched ? initialLocation.label : "");
  const [locationMessage, setLocationMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DiscoveryFilter[]>([]);
  const [sort, setSort] = useState("nearby");
  const [view, setView] = useState<"feed" | "map">("feed");
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(8);
  const kitchenById = useMemo(() => new globalThis.Map(kitchens.map(k => [k.id, k])), [kitchens]);
  const distance = (k: DiscoveryKitchen) => kitchenDistance(k, location.point);
  const available = useMemo(() => dishes.filter(d => dishAvailable(d, today)), [dishes, today]);
  const filtered = useMemo(() => {
    const matched = available.filter(d => { const k = kitchenById.get(d.kitchen_id); return k && matchesDiscovery(d, k, filters, query, today); });
    return matched.sort((a,b) => {
      if (sort === "price") return a.price_cents - b.price_cents;
      if (sort === "rating") return (b.rating_count ? b.avg_rating_10 : -1) - (a.rating_count ? a.avg_rating_10 : -1);
      if (sort === "popular") return kitchenById.get(b.kitchen_id)!.orders_completed - kitchenById.get(a.kitchen_id)!.orders_completed;
      return (kitchenDistance(kitchenById.get(a.kitchen_id)!, location.point) ?? Infinity) - (kitchenDistance(kitchenById.get(b.kitchen_id)!, location.point) ?? Infinity);
    });
  }, [available, kitchenById, filters, query, sort, today, location.point]);
  const visibleKitchenIds = new Set(filtered.map(d => d.kitchen_id));
  const matchingKitchens = useMemo(() => kitchens.filter(k => filtered.some(d => d.kitchen_id === k.id)), [kitchens, filtered]);
  const preferred = new Set(kitchens.filter(k => visited.includes(k.id)).flatMap(k => k.cuisine_tags));
  const suggestions = [...kitchens].filter(k => !visited.includes(k.id)).sort((a,b) => recommendationScore(b, preferred, location.point) - recommendationScore(a, preferred, location.point)).slice(0,4);
  const favorites = [...kitchens].filter(k => k.repeat_customers > 0 && Number(k.avg_rating_10) > 0 && k.upheld_flags === 0 && k.open_incidents === 0).sort((a,b) => b.repeat_customers - a.repeat_customers || b.orders_completed - a.orders_completed).slice(0,4);
  const family = available.filter(d => d.serves >= 3 || d.meal_tags.includes("family_trays")).slice(0,4);
  const offers = available.filter(d => hasOffer(d, now)).slice(0,4);
  function toggleFilter(key: DiscoveryFilter) { setFilters(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]); setLimit(8); }
  function selectFamily() { setFilters(["family_trays"]); setQuery(""); setLimit(8); document.getElementById("nearby-feed")?.scrollIntoView({ block: "start" }); }
  function useLocation() {
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable here. Enter a town or ZIP instead."); return; }
    setLocationMessage("Finding your area…");
    navigator.geolocation.getCurrentPosition(position => {
      setLocation({ point: { lat: position.coords.latitude, lng: position.coords.longitude }, label: "Your current area", matched: true });
      setLocationText(""); setLocationMessage("Using your location on this device. It is not saved to your profile.");
    }, () => setLocationMessage("We couldn’t access your location. Enter a town or ZIP instead."), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }
  const dishCards = (rows: DiscoveryDish[]) => <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rows.map(d => { const k = kitchenById.get(d.kitchen_id); return k ? <li key={d.id} className="min-w-0"><DiscoveryDishCard dish={d} kitchen={k} miles={distance(k)} offer={hasOffer(d, now)} /></li> : null; })}</ul>;
  const kitchenCards = (rows: DiscoveryKitchen[]) => <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rows.map(k => <li key={k.id} className="min-w-0"><KitchenCard kitchen={k} miles={distance(k)} /></li>)}</ul>;
  return <>
    <div className="mt-7 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:p-5">
      <form onSubmit={event => { event.preventDefault(); const next = resolveLocation(locationText); setLocation(next); setLocationMessage(next.matched ? "" : "That location isn’t in our local directory yet. Showing Bergen County instead."); }} className="flex min-w-0 flex-wrap items-center gap-2">
        <MapPin className="h-5 w-5 shrink-0 text-forest" aria-hidden /><label htmlFor="discovery-location" className="sr-only">Town or ZIP code</label>
        <input id="discovery-location" value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Town or ZIP code" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 text-base" />
        <button className="min-h-11 rounded-full bg-forest px-4 text-sm font-medium text-cream">Find food</button>
      </form>
      <button type="button" onClick={useLocation} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm text-forest"><LocateFixed className="h-4 w-4" aria-hidden />Use my location</button>
      <p role="status" className="text-xs text-ink-muted sm:col-span-2">{locationMessage || `Browsing ${location.matched ? location.label : "Bergen County"}. Distances are approximate; drive times are rough area estimates, without route or traffic data.`}</p>
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <Link href="/rewards" className="relative overflow-hidden rounded-2xl bg-forest p-6 text-cream"><Gift className="h-6 w-6 text-brass" aria-hidden /><p className="mt-4 text-xs font-medium text-cream/75">A little thank-you for eating local</p><h2 className="mt-2 font-sans text-2xl font-semibold">Your next meal could cost $5 less</h2><p className="mt-3 text-sm text-cream/85">Redeem 250 points for a $5 credit. $15 food minimum.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Explore rewards <ArrowRight className="h-4 w-4" aria-hidden /></span></Link>
      <button type="button" onClick={selectFamily} className="rounded-2xl border border-brass/25 bg-brass/10 p-6 text-left text-forest"><Users className="h-6 w-6" aria-hidden /><p className="mt-4 text-xs text-brass-ink">More seats. More stories.</p><h2 className="mt-2 font-sans text-2xl font-semibold">Dinner for the whole table</h2><p className="mt-3 text-sm text-ink-muted">Find family trays and generous portions to share.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Find family meals <ArrowRight className="h-4 w-4" aria-hidden /></span></button>
      <Link href="#community-favorites" className="rounded-2xl border border-line bg-forest-soft p-6 text-forest"><Sparkles className="h-6 w-6" aria-hidden /><p className="mt-4 text-xs text-ink-muted">The neighborhood knows</p><h2 className="mt-2 font-sans text-2xl font-semibold">Meet your next regular spot</h2><p className="mt-3 text-sm text-ink-muted">Discover the kitchens diners keep coming back to.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">See community favorites <ArrowRight className="h-4 w-4" aria-hidden /></span></Link>
    </div>
    <section id="nearby-feed" className="mt-10 scroll-mt-36">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-3xl text-forest">Cooking around the corner</h2><p className="mt-2 text-sm text-ink-muted">Search dishes, cuisines, and kitchens. Pickup directly from your cook.</p></div><div className="flex rounded-full border border-line bg-surface p-1">{(["feed","map"] as const).map(mode => <button key={mode} onClick={() => setView(mode)} aria-pressed={view === mode} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm", view === mode ? "bg-forest text-cream" : "text-forest")}>{mode === "feed" ? <List className="h-4 w-4" aria-hidden /> : <Map className="h-4 w-4" aria-hidden />}{mode === "feed" ? "Feed" : "Map"}</button>)}</div></div>
      <div className="mt-5 flex flex-wrap gap-3"><label className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto"><span className="sr-only">Search dishes, kitchens or cuisines</span><Search className="absolute left-4 top-3.5 h-5 w-5 text-ink-muted" aria-hidden /><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(8); }} placeholder="Biryani, burgers, kunafa…" className="min-h-12 w-full rounded-full border border-line bg-surface pl-12 pr-4 text-base" /></label><button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="discovery-filters" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-forest"><SlidersHorizontal className="h-4 w-4" aria-hidden />Filters{filters.length ? ` (${filters.length})` : ""}</button><label className="sr-only" htmlFor="dish-sort">Sort dishes</label><select id="dish-sort" value={sort} onChange={e => setSort(e.target.value)} className="min-h-12 rounded-full border border-line bg-surface px-4 text-sm"><option value="nearby">Nearest first</option><option value="popular">Meals served</option><option value="rating">Dish rating</option><option value="price">Lowest price</option></select></div>
      <div id="discovery-filters" hidden={!showFilters} className="mt-4 rounded-2xl border border-line bg-surface p-5"><div className="flex flex-wrap gap-2">{DISCOVERY_FILTERS.map(filter => <button key={filter.key} onClick={() => toggleFilter(filter.key)} aria-pressed={filters.includes(filter.key)} className={cn("min-h-11 rounded-full border px-4 py-2 text-sm", filters.includes(filter.key) ? "border-forest bg-forest text-cream" : "border-line text-ink")}>{filter.label}</button>)}</div><p className="mt-4 text-xs leading-relaxed text-ink-muted">Zabiha, hand slaughter, no-pork handling, and vegetarian labels are seller declarations, not Dishd certification. Receipt checks verify sourcing paperwork. Read each dish&apos;s allergens and ask the cook about cross-contact.</p></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p aria-live="polite" className="text-sm text-ink-muted">{filtered.length} dishes · {visibleKitchenIds.size} kitchens</p>{(filters.length > 0 || query) && <button onClick={() => { setFilters([]); setQuery(""); }} className="min-h-10 text-sm text-forest underline">Clear search and filters</button>}</div>
      {view === "map" && <NearbyMap kitchens={matchingKitchens} origin={location.point} />}
      {unavailable ? <p role="status" className="mt-5 rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">Menus are taking a little longer. You can still explore kitchens below.</p> : filtered.length ? dishCards(filtered.slice(0,limit)) : <div className="mt-5 rounded-2xl border border-dashed border-line bg-surface-sunk p-8 text-center"><p className="text-forest">No available dishes match those choices yet.</p><p className="mt-2 text-sm text-ink-muted">Try another dish or clear a filter. Seller claims appear only when declared.</p></div>}
      {filtered.length > limit && <button onClick={() => setLimit(limit + 8)} className="mx-auto mt-5 block min-h-11 rounded-full border border-forest px-6 text-sm text-forest">Show more dishes</button>}
    </section>
    <section className="mt-12"><h2 className="font-display text-3xl text-forest">Today&apos;s offers</h2><p className="mt-2 text-sm text-ink-muted">Current kitchen offers and a little help from your Neighborhood Points.</p>{offers.length > 0 && dishCards(offers)}<Link href="/rewards" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brass/30 bg-brass/10 p-6"><div><h3 className="font-sans text-xl font-semibold text-forest">Put your points toward dinner</h3><p className="mt-2 text-sm text-ink-muted">250 points = $5 off a $15+ food order. 500 points = $10 off $25+. Redeem a credit before checkout.</p></div><span className="inline-flex items-center gap-2 text-sm font-medium text-forest">View available rewards <ArrowRight className="h-4 w-4" aria-hidden /></span></Link></section>
    <section className="mt-12"><h2 className="font-display text-3xl text-forest">Places you might like</h2><p className="mt-2 text-sm text-ink-muted">{preferred.size ? "Familiar flavors from kitchens you haven’t tried, with nearby options first." : "A few nearby kitchens to get your food diary started."}</p>{kitchenCards(suggestions.length ? suggestions : kitchens.slice(0,4))}</section>
    <section id="community-favorites" className="mt-12 scroll-mt-36"><h2 className="font-display text-3xl text-forest">Community favorites</h2><p className="mt-2 text-sm text-ink-muted">Chosen by recorded repeat customers, with completed pickups behind every meal count.</p>{favorites.length ? kitchenCards(favorites) : <p className="mt-5 rounded-2xl bg-surface-sunk p-6 text-sm text-ink-muted">Neighborhood favorites will appear as kitchens build a record of returning diners.</p>}</section>
    <section className="mt-12"><h2 className="font-display text-3xl text-forest">Family meals</h2><p className="mt-2 text-sm text-ink-muted">Family trays and portions for three or more, as listed by the cook.</p>{family.length ? dishCards(family) : <div className="mt-5 rounded-2xl border border-line bg-surface p-6"><p className="text-sm text-ink-muted">No family trays are listed right now. Browse kitchens for the next shared meal.</p><button onClick={selectFamily} className="mt-3 min-h-11 text-sm font-medium text-forest underline">Browse family trays</button></div>}</section>
    <DemoVideos />
  </>;
}
