import { pendingPickupReviews } from "@/lib/social/pickup-reviews";
import { PickupReviewPrompt } from "@/components/social/pickup-review-prompt";

export async function PendingPickupReviews({ buyerId }: { buyerId: string }) {
  return <PickupReviewPrompt initial={await pendingPickupReviews(buyerId)} />;
}
