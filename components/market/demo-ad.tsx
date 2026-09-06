import Link from "next/link";
import { Coffee, Leaf, Package } from "lucide-react";

export const DEMO_ADS = [
  { slug: "little-leaf", name: "Little Leaf Pantry", title: "Good ingredients. Neighborly prices.",
    body: "A sample promotion for a neighborhood pantry, stocked with everyday cooking essentials.", icon: Leaf },
  { slug: "table-and-twine", name: "Table & Twine", title: "Made with care. Packed with care.",
    body: "A sample promotion for takeaway boxes and simple supplies for home kitchens.", icon: Package },
  { slug: "corner-cup", name: "Corner Cup", title: "A little pause after your pickup.",
    body: "A sample promotion for a cozy neighborhood cafe and its afternoon brews.", icon: Coffee },
];

export function DemoAd({ variant = 0 }: { variant?: number }) {
  const ad = DEMO_ADS[variant % DEMO_ADS.length];
  const Icon = ad.icon;
  return <aside aria-label="Demo advertisement" className="mt-8 rounded-2xl border border-brass/30 bg-surface p-6">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
      <span className="rounded-full bg-brass/15 px-3 py-1 font-medium text-brass-ink">Demo ad &middot; Fictional sponsor</span>
      <span>{ad.name}</span>
    </div>
    <div className="mt-4 flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest-soft text-forest"><Icon aria-hidden className="h-6 w-6" /></span>
      <div className="min-w-0"><h2 className="text-lg font-medium text-forest">{ad.title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{ad.body}</p>
        <Link href={"/demo/ads#" + ad.slug} className="mt-3 inline-block py-2 text-sm font-medium text-forest underline underline-offset-4">View sample promotion</Link>
      </div>
    </div>
    <p className="mt-3 text-xs text-ink-muted">Preview only. No paid placement, tracking, or real offer.</p>
  </aside>;
}
