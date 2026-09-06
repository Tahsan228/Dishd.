"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const SEEN_KEY = "dishd.viewed";

/**
 * Records that someone opened a kitchen page.
 *
 * Client-side so a bot fetching HTML does not inflate the number, and once per
 * kitchen per browser session so a cook refreshing their own page does not
 * invent demand. Failures are swallowed: a missing analytics row is never worth
 * an error in front of a buyer.
 */
export function TrackKitchenView({ kitchenId }: { kitchenId: string }) {
  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]");
    } catch {
      seen = [];
    }
    if (Array.isArray(seen) && seen.includes(kitchenId)) return;

    try {
      window.sessionStorage.setItem(
        SEEN_KEY,
        JSON.stringify([...(Array.isArray(seen) ? seen : []), kitchenId].slice(-50)),
      );
    } catch {
      // Private windows throw; still worth recording the view.
    }

    createClient()
      .from("kitchen_views")
      .insert({ kitchen_id: kitchenId, kind: "page_view" })
      .then(
        () => undefined,
        () => undefined,
      );
  }, [kitchenId]);

  return null;
}
