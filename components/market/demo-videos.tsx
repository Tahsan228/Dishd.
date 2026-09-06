"use client";
import { useState } from "react";
import { Play, X } from "lucide-react";

const clips = [
  { id: "supper", title: "A little supper inspiration", description: "An illustrated pot of rice, vegetables, and rising steam." },
  { id: "family", title: "Made for sharing", description: "An illustrated family platter with colorful vegetables and rice." },
  { id: "sweet", title: "Save room for something sweet", description: "An illustrated golden dessert with pistachio-colored toppings." },
];
export function DemoVideos() {
  const [active, setActive] = useState<string | null>(null);
  return <section className="mt-12"><div className="flex flex-wrap items-baseline gap-3"><h2 className="font-display text-3xl text-forest">A peek into the kitchen</h2><span className="rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass-ink">Demo videos</span></div><p className="mt-2 text-sm text-ink-muted">Short illustrated stories showing how cooks could share their food. These are demos, not footage from listed kitchens.</p>
    <div className="mt-5 grid gap-5 sm:grid-cols-3">{clips.map(clip => <article key={clip.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-[4/5] overflow-hidden bg-forest-soft">{active === clip.id ? <><video controls playsInline autoPlay preload="none" className="h-full w-full object-cover" poster={`/videos/${clip.id}.png`} aria-label={clip.title + ". Silent demo illustration."} onEnded={() => setActive(null)}><source src={`/videos/${clip.id}.webm`} type="video/webm" />Your browser cannot play this video.</video><button aria-label="Close demo video" onClick={() => setActive(null)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-cream text-forest"><X className="h-5 w-5" /></button></> : <button onClick={() => setActive(clip.id)} aria-label={"Play demo: " + clip.title} className="group relative h-full w-full text-left">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/videos/${clip.id}.png`} alt={clip.description} loading="lazy" decoding="async" className="h-full w-full object-cover" /><span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-cream px-4 py-3 text-sm font-medium text-forest"><Play className="h-4 w-4 fill-current" aria-hidden />Play demo · 6 sec</span></button>}</div>
      <div className="p-4"><h3 className="font-sans text-base font-semibold text-forest">{clip.title}</h3><p className="mt-1 text-xs text-ink-muted">Dishd concept clip · Silent animation</p></div>
    </article>)}</div>
  </section>;
}
