import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

export type RewardSummary = { balance: number; earned: number; available: boolean };

/** Request-scoped only. A history preview must never be used as the balance. */
export const getRewardSummary = cache(async (userId: string): Promise<RewardSummary> => {
  const client = await createServerClient();
  const result = await client.rpc("dishd_reward_summary");
  if (!result.error && result.data?.[0]) {
    return { balance: Number(result.data[0].balance), earned: Number(result.data[0].earned), available: true };
  }
  // Supports deployments awaiting the summary RPC. RLS still scopes every row.
  let balance = 0, earned = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("reward_events").select("points,id")
      .eq("user_id", userId).order("id").range(offset, offset + 999);
    if (error || !data) return { balance: 0, earned: 0, available: false };
    for (const row of data) { balance += row.points; earned += Math.max(0, row.points); }
    if (data.length < 1000) return { balance, earned, available: true };
  }
});
