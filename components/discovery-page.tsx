"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, Clock3, CookingPot, Croissant, Fish, Flame, Heart, Leaf, MapPin, Search, SlidersHorizontal, Soup, Sparkles, Star, Utensils, X } from "lucide-react";
import { kitchens } from "@/lib/demo-data";
import { discoverKitchens } from "@/lib/discovery";
import { CommunityFeed } from "@/components/community-feed";
import { KitchenCard } from "@/components/kitchen-card";
import { KitchenDialog } from "@/components/kitchen-dialog";
import { useSavedKitchens } from "@/components/use-saved-kitchens";

const cuisines = [
  { name: "All kitchens", Icon: Utensils }, { name: "Pakistani", Icon: Soup },
  { name: "Bangladeshi", Icon: Fish }, { name: "Middle Eastern", Icon: Leaf },
  { name: "Indian", Icon: Flame }, { name: "Bakes & bites", Icon: Croissant },
];

export function DiscoveryPage() {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("All kitchens");
  const [city, setCity] = useState("East Bay");
  const [today, setToday] = useState(false);
  const [budget, setBudget] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { saved, toggle } = useSavedKitchens();
  const searchInput = useRef<HTMLInputElement>(null);
  const selected = kitchens.find((kitchen) => kitchen.id === selectedId) ?? null;
  const results = discoverKitchens(kitchens, { query, cuisine, city, today, budget, sort, savedOnly, saved });

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault(); searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function clearFilters() { setQuery(""); setCuisine("All kitchens"); setCity("East Bay"); setToday(false); setBudget(false); setSort("recommended"); }
  function showDiscover() { setSavedOnly(false); clearFilters(); window.scrollTo({ top: 0, behavior: "instant" }); }
  function showSaved() { setSavedOnly(true); clearFilters(); window.scrollTo({ top: 0, behavior: "instant" }); }

  return <>
    <a className="skip-link" href="#kitchens">Skip to kitchens</a>
    <header className="site-header"><div className="page-width header-inner">
      <button className="wordmark" onClick={showDiscover} aria-label="Dishd home"><CookingPot strokeWidth={1.7} size={29} /><span>dishd<span className="brand-dot">.</span></span></button>
      <nav className="main-nav" aria-label="Main navigation"><button className={!savedOnly ? "active" : ""} onClick={showDiscover}>Discover</button><a href="#community">The community</a><button className={savedOnly ? "active" : ""} onClick={showSaved}>Saved{saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button></nav>
      <div className="header-actions"><label className="location-select"><MapPin size={16} /><select aria-label="Choose your neighborhood" value={city} onChange={(event) => setCity(event.target.value)}><option value="East Bay">East Bay, CA</option><option value="Oakland">Oakland, CA</option><option value="Berkeley">Berkeley, CA</option></select><ChevronDown size={12} /></label><span className="preview-pill"><span />Demo neighborhood</span></div>
    </div></header>

    <main className="page-width">
      {!savedOnly ? <section className="hero" aria-label="Welcome to Dishd">
        <div className="hero-copy"><p className="eyebrow"><span className="little-line" />Good food. Good neighbors.</p><h1>Your next favorite<br />is <em>closer to home.</em></h1><p className="hero-description">Extraordinary meals from everyday home cooks.<br className="desktop-break" /> All halal. All made with a little more heart.</p><a className="primary-button" href="#kitchens">Find your next favorite <ArrowUpRight size={18} /></a><div className="hero-people"><div className="avatar-stack"><span>AK</span><span>NT</span><span>RR</span></div><div><span className="tiny-stars" aria-label="Community favorites">★★★★★</span><p>Small kitchens. A whole lot of love.</p></div></div></div>
        <div className="hero-visual"><div className="hero-image-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-image" src="/images/biryani.png" alt="A generous bowl of home-cooked chicken biryani, with fresh herbs and raita" width={1536} height={1024} fetchPriority="high" />
          <span className="hero-image-caption"><CookingPot size={14} />Not a restaurant. A home.</span>
        </div><div className="food-seal" aria-hidden="true"><span>SMALL BATCHES</span><Heart size={26} strokeWidth={1.3} /><span>BIG HEART</span></div><button className="hero-kitchen-note" onClick={() => setSelectedId("aminas-kitchen")}><span className="note-eyebrow"><Sparkles size={12} />TONIGHT’S LITTLE OBSESSION</span><strong>Amina’s chicken biryani</strong><span className="note-bottom"><span><Star size={12} fill="currentColor" />4.9 <span>· Made in Temescal</span></span><ArrowUpRight size={18} /></span></button></div>
      </section> : <section className="saved-heading"><p className="eyebrow"><Heart size={14} />Your little collection</p><h1>A table for <em>your favorites.</em></h1><p>Good kitchens are worth keeping close. Your saved places stay here on this device.</p></section>}

      {!savedOnly && <div className="values-strip"><span><Leaf size={16} />Halal at heart</span><i /><span><CookingPot size={16} />Made in real home kitchens</span><i /><span><Heart size={16} />A neighborhood, not just a menu</span><a href="#community">Pull up a chair <ArrowDown size={14} /></a></div>}

      <section className="discovery-section" id="kitchens" aria-label="Find a home kitchen">
        <div className="section-heading"><div><p className="eyebrow">A good meal is just around the corner</p><h2>{savedOnly ? "Saved for another helping." : "Made in your neighborhood."}</h2></div><span className="section-side-note"><MapPin size={14} />{city}, California</span></div>
        <div className="search-row"><div className="search-field" role="search"><Search size={19} /><input ref={searchInput} type="search" aria-label="Search kitchens, dishes, or cuisines" placeholder="What are you craving?" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <button aria-label="Clear search" onClick={() => setQuery("")}><X size={16} /></button> : <kbd>/</kbd>}</div><label className="sort-control"><SlidersHorizontal size={16} /><select aria-label="Sort kitchens" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="rating">Top rated</option><option value="distance">Closest to you</option><option value="price">Price: low to high</option></select><ChevronDown size={12} /></label></div>
        <div className="cuisine-row" aria-label="Filter by cuisine">{cuisines.map(({ name, Icon }) => <button key={name} className={`cuisine-chip ${cuisine === name ? "selected" : ""}`} aria-pressed={cuisine === name} onClick={() => setCuisine(name)}><Icon size={16} strokeWidth={1.6} />{name}</button>)}</div>
        <div className="results-toolbar"><p aria-live="polite"><strong>{results.length}</strong> {results.length === 1 ? "kitchen" : "kitchens"} {savedOnly ? "in your collection" : "to fall in love with"}</p><div className="quick-filters"><button className={today ? "filter-on" : ""} aria-pressed={today} onClick={() => setToday(!today)}>{today ? <Check size={13} /> : <Clock3 size={13} />}Pickup today</button><button className={budget ? "filter-on" : ""} aria-pressed={budget} onClick={() => setBudget(!budget)}>{budget && <Check size={13} />}Mains $15 or less</button></div></div>
        {results.length ? <div className="kitchen-grid">{results.map((kitchen) => <KitchenCard key={kitchen.id} kitchen={kitchen} saved={saved.includes(kitchen.id)} onSave={() => toggle(kitchen.id)} onOpen={() => setSelectedId(kitchen.id)} />)}</div> : <div className="empty-state"><CookingPot size={34} strokeWidth={1.2} /><h3>{savedOnly && !saved.length ? "Your next favorite is out there." : "Nothing on the table just yet."}</h3><p>{savedOnly && !saved.length ? "Tap the heart on a kitchen to save a little inspiration for later." : "Try another craving or give your filters a little more room."}</p><button className="primary-button" onClick={savedOnly && !saved.length ? showDiscover : clearFilters}>{savedOnly && !saved.length ? "Discover kitchens" : "Clear filters"}<ArrowRight size={16} /></button></div>}
      </section>

      <CommunityFeed onOpen={setSelectedId} />
      <section className="closing-note"><span className="closing-icon"><CookingPot size={30} strokeWidth={1.3} /></span><div><p className="eyebrow">More than what’s for dinner</p><h2>Behind every great meal,<br />there’s a neighbor worth knowing.</h2></div><a href="#kitchens" className="light-button">Meet your neighborhood cooks <ArrowUpRight size={17} /></a></section>
    </main>
    <footer className="site-footer page-width"><div><span className="footer-wordmark">dishd<span>.</span></span><p>A little closer to home.</p></div><p className="demo-disclosure"><BadgeCheck size={15} />You’re exploring a sample neighborhood.<br />Kitchens, reviews, and pickup times are demo data.</p><a href="#kitchens">Back to the good stuff <ArrowUpRight size={14} /></a></footer>
    <div className="mobile-nav"><button onClick={showDiscover} className={!savedOnly ? "active" : ""}><Utensils size={19} />Discover</button><a href="#community"><Soup size={19} />Community</a><button onClick={showSaved} className={savedOnly ? "active" : ""}><Heart size={19} />Saved {saved.length > 0 && <span>{saved.length}</span>}</button></div>
    <KitchenDialog kitchen={selected} saved={selected ? saved.includes(selected.id) : false} onSave={() => { if (selected) toggle(selected.id); }} onClose={() => setSelectedId(null)} />
    <span className="sr-only" role="status" aria-live="polite">{saved.length} kitchens saved</span>
  </>;
}
