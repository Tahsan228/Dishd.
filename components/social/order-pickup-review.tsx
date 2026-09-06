import { createServerClient } from "@/lib/supabase/server";
import { readPickupReview } from "@/lib/social/pickup-reviews";
import { PickupReviewPanel } from "@/components/social/pickup-review-panel";
export async function OrderPickupReview({ orderId }: { orderId: string }) {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: owned } = await client.from("orders").select("id").eq("id", orderId).eq("buyer_id", user.id).eq("status", "completed").maybeSingle();
  if (!owned) return null;
  return <section id="review" className="scroll-mt-28"><PickupReviewPanel orderId={orderId} initialReview={await readPickupReview(orderId, user.id)} /></section>;
}
