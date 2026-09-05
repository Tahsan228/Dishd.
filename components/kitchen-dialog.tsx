"use client";

import { useEffect, useRef } from "react";
import { Heart, MapPin, Star, X, Clock3, Leaf } from "lucide-react";
import type { Kitchen } from "@/lib/demo-data";
import { money } from "@/lib/discovery";

export function KitchenDialog({ kitchen, saved, onSave, onClose }: { kitchen: Kitchen | null; saved: boolean; onSave: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (kitchen) element.showModal(); else if (element.open) element.close();
    const oldOverflow = document.body.style.overflow;
    if (kitchen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; };
  }, [kitchen]);
  return <dialog ref={dialog} className="kitchen-dialog" aria-labelledby="kitchen-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    {kitchen && <>
      <div className="dialog-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={kitchen.image} alt={kitchen.imageAlt} />
        <button className="dialog-close" onClick={onClose} aria-label="Close kitchen details"><X size={21} /></button>
        <span className="dialog-cook-avatar">{kitchen.initials}</span>
      </div>
      <div className="dialog-content">
        <div className="dialog-heading"><div><p className="eyebrow">Welcome to {kitchen.cook}’s table</p><h2 id="kitchen-dialog-title">{kitchen.name}</h2></div><button className={`outline-button ${saved ? "saved" : ""}`} onClick={onSave}><Heart size={16} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save kitchen"}</button></div>
        <div className="dialog-meta"><span><MapPin size={14} />{kitchen.neighborhood}, {kitchen.city}</span><span><Star size={14} fill="currentColor" />{kitchen.rating.toFixed(1)} · {kitchen.reviews} reviews</span><span><Clock3 size={14} />{kitchen.pickup}</span></div>
        <p className="cook-story">{kitchen.description}</p>
        <div className="source-note"><Leaf size={17} /><p>A home kitchen with halal at heart. In the live marketplace, sourcing evidence and completed pickups will build this kitchen’s public record.</p></div>
        <div className="dialog-menu-heading"><h3>A little taste of the menu</h3><span>{kitchen.cuisine}</span></div>
        <ul className="preview-menu">{kitchen.menu.map((item) => <li key={item.name}><div><h4>{item.name}</h4><p>{item.description}</p></div><strong>{money(item.priceCents)}</strong></li>)}</ul>
        <p className="demo-note">Sample kitchen · Browsing preview only. No real orders or payments.</p>
      </div>
    </>}
  </dialog>;
}
