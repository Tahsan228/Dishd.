import { BadgeCheck } from "lucide-react";
import type { BuyerTier, CredibilityTier } from "@/lib/types";
import { tierLabel } from "@/lib/social/credibility";
import { cn } from "@/lib/utils";

export function TierMark({ tier }: { tier: CredibilityTier | BuyerTier }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
      (tier === "new_kitchen" || tier === "newcomer") && "border-ink-muted bg-surface text-ink-muted",
      (tier === "established" || tier === "regular") && "border-forest bg-forest-soft text-forest",
      (tier === "trusted_kitchen" || tier === "trusted_taster") && "border-brass bg-brass text-forest-deep",
      (tier === "dishd_verified" || tier === "community_pillar") && "border-brass bg-forest text-cream",
    )}>
      <BadgeCheck aria-hidden="true" className={cn("size-4 shrink-0", (tier === "dishd_verified" || tier === "community_pillar") && "text-brass")} />
      {tierLabel(tier)}
    </span>
  );
}
