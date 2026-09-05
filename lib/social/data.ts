import { createServerClient } from "@/lib/supabase/server";
import type { KitchenCounters, Log, ProfilePublic } from "@/lib/types";

export const KITCHEN_COUNTER_COLUMNS = "orders_completed,avg_rating_10,distinct_customers,repeat_customers,trust_streak,permit_status,upheld_flags,open_incidents,cook_cancellations,created_at";
export const PROFILE_COLUMNS = "id,handle,display_name,avatar_url,bio,city,created_at";
export const LOG_COLUMNS = "id,buyer_id,kitchen_id,order_id,rating_10,body,photo_url,photo_urls,flavor_rating_10,value_rating_10,quality_rating_10,is_verified,sourcing_affirmed,logged_at";
export const REVIEW_COLUMNS = `${LOG_COLUMNS},author:profiles!logs_buyer_id_fkey(${PROFILE_COLUMNS}),kitchen:kitchens!logs_kitchen_id_fkey(name,slug)`;

// SQL auto-check-ins are unrated until the buyer rates them. Keep that distinction
// locally without changing the frozen domain contract.
export type DiaryLog = Omit<Log, "rating_10"> & { rating_10: number | null; photo_urls?: string[]; flavor_rating_10?: number | null; value_rating_10?: number | null; quality_rating_10?: number | null };
export type ReviewEntry = DiaryLog & {
  author: ProfilePublic | null;
  kitchen: { name: string; slug: string } | null;
};
export type KitchenSummary = KitchenCounters & { id: string; name: string; slug: string; status: string };

export async function socialClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return createServerClient();
}

export function safeImageUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value === 0 ? 0 : value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
