import Link from "next/link";
import { socialClient } from "@/lib/social/data";
import { RecoverReviewButton } from "./recover-review-button";

/** Drop into the host's completed-order page; resolves the trigger-created log. */
export async function OrderReviewLink({ orderId }: { orderId: string }) {
  const supabase = await socialClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("logs").select("id,rating_10")
    .eq("order_id", orderId).eq("buyer_id", user.id).eq("is_verified", true).maybeSingle();
  if (error || !data) return <RecoverReviewButton orderId={orderId} />;
  return <Link href={`/log/${data.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-cream hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{data.rating_10 === null ? "Rate your meal" : "View your meal diary entry"}</Link>;
}
