"use client";
import { useEffect, useRef, useState } from "react";
import type { DiscoveryKitchen } from "@/lib/market/discovery";
import { validPoint } from "@/lib/market/discovery";
import type { LatLng } from "@/lib/market/geo";
import "maplibre-gl/dist/maplibre-gl.css";

export default function NearbyMap({ kitchens, origin }: { kitchens: DiscoveryKitchen[]; origin: LatLng }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose: (() => void) | undefined, cancelled = false;
    import("maplibre-gl").then(({ Map, Marker, NavigationControl }) => {
      if (cancelled || !container.current) return;
      const map = new Map({ container: container.current, center: [origin.lng, origin.lat], zoom: 11,
        style: { version: 8, sources: { neighborhood: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' } }, layers: [{ id: "neighborhood", type: "raster", source: "neighborhood" }] } });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("error", () => setFailed(true));
      for (const kitchen of kitchens) {
        if (!validPoint({ lat: kitchen.approx_lat, lng: kitchen.approx_lng })) continue;
        const link = document.createElement("a");
        link.href = "/k/" + encodeURIComponent(kitchen.slug);
        link.className = "rounded-full border-2 border-cream bg-forest px-3 py-2 text-xs font-semibold text-cream shadow-md";
        link.textContent = kitchen.name;
        link.setAttribute("aria-label", kitchen.name + ", approximate kitchen area");
        new Marker({ element: link }).setLngLat([kitchen.approx_lng, kitchen.approx_lat]).addTo(map);
      }
      dispose = () => map.remove();
    }).catch(() => setFailed(true));
    return () => { cancelled = true; dispose?.(); };
  }, [kitchens, origin]);
  return <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
    <div ref={container} role="region" aria-label="Map of approximate kitchen areas" className="h-80 w-full sm:h-96" />
    <p className="p-3 text-xs text-ink-muted">{failed ? "The map is unavailable. All kitchens are still listed below. " : ""}Pins show approximate neighborhood areas. Exact pickup addresses unlock after an order is accepted.</p>
  </div>;
}
