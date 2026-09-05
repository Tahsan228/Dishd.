import type { KitchenCounters } from "@/lib/types";
import { computedKitchenBadges, earnedBadges } from "@/lib/social/badges";
import { KITCHEN_COUNTER_COLUMNS, socialClient } from "@/lib/social/data";
import { BadgeShelf } from "@/components/social/badge-shelf";
import { SocialNotice } from "@/components/social/social-notice";

export async function KitchenBadgeShelf({ kitchenId }: { kitchenId: string }) {
  const supabase = await socialClient();
  if (!supabase) return <SocialNotice title="Earned along the way">Kitchen badges will appear when Dishd is connected.</SocialNotice>;
  const [kitchen, granted] = await Promise.all([
    supabase.from("kitchens").select(KITCHEN_COUNTER_COLUMNS).eq("id", kitchenId).maybeSingle(),
    supabase.from("kitchen_badges").select("badge_code").eq("kitchen_id", kitchenId),
  ]);
  if (kitchen.error || !kitchen.data || granted.error) return <SocialNotice title="Kitchen badges">We couldn’t load the badge shelf. Please try again shortly.</SocialNotice>;
  const badges = earnedBadges("kitchen", computedKitchenBadges(kitchen.data as KitchenCounters), (granted.data ?? []).map((badge) => badge.badge_code));
  return <section aria-label="Kitchen badges"><h2 className="mb-4 font-display text-2xl text-ink">Earned along the way</h2><BadgeShelf badges={badges} /></section>;
}
