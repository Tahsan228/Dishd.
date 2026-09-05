import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Clock, Gift, Sparkles, TicketPercent, XCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { MissionForm, RedeemPanel } from "@/components/market/reward-forms";
import {
  EARN_RULES,
  nextRewardProgress,
  pointsBalance,
  pointsEarned,
  type RewardCatalogItem,
  type RewardClaim,
  type RewardEvent,
  type RewardRedemption,
} from "@/lib/market/rewards";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Neighborhood Points · Dishd",
  description: "Points for eating from small kitchens, and credits to spend on them.",
};

export default async function RewardsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=%2Frewards");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Frewards");

  const [eventsResult, catalogResult, redemptionsResult, claimsResult, ordersResult] =
    await Promise.all([
      supabase
        .from("reward_events")
        .select("id, source_key, kind, points, description, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("reward_catalog").select("*").eq("active", true).order("points_cost"),
      supabase
        .from("reward_redemptions")
        .select("id, reward_code, credit_cents, minimum_order_cents, status, order_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("reward_claims")
        .select("id, mission, kitchen_id, proof_url, notes, status, resolution_note, created_at")
        .order("created_at", { ascending: false }),
      // Kitchens this buyer has actually collected from — the only ones they
      // can honestly make a video about.
      supabase
        .from("orders")
        .select("kitchen_id, kitchens ( id, name )")
        .eq("buyer_id", user.id)
        .eq("status", "completed")
        .limit(50),
    ]);

  const events = (eventsResult.data ?? []) as RewardEvent[];
  const catalog = (catalogResult.data ?? []) as RewardCatalogItem[];
  const redemptions = (redemptionsResult.data ?? []) as RewardRedemption[];
  const claims = (claimsResult.data ?? []) as RewardClaim[];

  const balance = pointsBalance(events);
  const earned = pointsEarned(events);
  const progress = nextRewardProgress(balance, catalog);

  const seen = new Map<string, string>();
  for (const row of ordersResult.data ?? []) {
    const kitchen = row.kitchens as unknown as { id: string; name: string } | null;
    if (kitchen) seen.set(kitchen.id, kitchen.name);
  }
  const orderedKitchens = [...seen.entries()].map(([id, name]) => ({ id, name }));

  const available = redemptions.filter((r) => r.status === "available");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest sm:text-4xl">Neighborhood Points</h1>
        <p className="mt-2 max-w-xl leading-relaxed text-ink-muted">
          Points for eating from small kitchens near you, and for helping other
          people find them. They are separate from a kitchen&rsquo;s credibility
          score, which no one can buy.
        </p>

        {/* -------------------------------------------------------- balance */}
        <section className="rise mt-6 overflow-hidden rounded-2xl border border-brass/40 bg-brass/5">
          <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="text-xs tracking-wide text-brass-ink uppercase">Your balance</p>
              <p className="tabular font-display text-5xl leading-none text-forest">{balance}</p>
              <p className="tabular mt-1 text-xs text-ink-muted">
                {earned} earned all time
              </p>
            </div>
            {available.length > 0 && (
              <p className="flex items-center gap-2 rounded-full border border-forest/30 bg-forest-soft px-4 py-2 text-sm text-forest">
                <TicketPercent className="h-4 w-4" aria-hidden />
                <span className="tabular font-medium">
                  {formatCents(available.reduce((n, r) => n + r.credit_cents, 0))} in credit ready
                </span>
              </p>
            )}
          </div>

          {progress && (
            <div className="border-t border-brass/25 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Next: {progress.name}</span>
                <span className="tabular">{progress.needed} to go</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunk">
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-700"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* --------------------------------------------------------- spend */}
        <h2 className="mt-10 flex items-center gap-2 font-display text-2xl text-forest">
          <Gift className="h-5 w-5" aria-hidden />
          Spend your points
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Credits come off the real total at checkout — cash or card.
        </p>
        <div className="mt-4">
          <RedeemPanel catalog={catalog} balance={balance} />
        </div>

        {available.length > 0 && (
          <ul className="mt-4 space-y-2">
            {available.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forest/25 bg-forest-soft/60 p-3 text-xs"
              >
                <span className="font-medium text-forest">
                  {formatCents(r.credit_cents)} credit ready to use
                </span>
                <span className="text-ink-muted">
                  On orders over {formatCents(r.minimum_order_cents)} ·{" "}
                  <Link href="/cart" className="text-forest underline underline-offset-2">
                    go to cart
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ---------------------------------------------------------- earn */}
        <h2 className="mt-10 font-display text-2xl text-forest">How you earn</h2>
        <ul className="stagger mt-4 grid gap-3 sm:grid-cols-2">
          {EARN_RULES.map((rule) => (
            <li
              key={`${rule.kind}-${rule.label}`}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-ink">{rule.label}</p>
                <span className="tabular shrink-0 font-display text-lg text-brass-ink">
                  +{rule.points}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{rule.detail}</p>
              {rule.moderated && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber">
                  <Clock className="h-3 w-3" aria-hidden />
                  Reviewed before points are added
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* ------------------------------------------------------ missions */}
        <h2 className="mt-10 font-display text-2xl text-forest">Post a video</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Made something that gets people eating from these kitchens? Send it in.
          A reviewer checks every submission before points are added.
        </p>
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <MissionForm kitchens={orderedKitchens} />
        </div>

        {claims.length > 0 && (
          <ul className="mt-4 space-y-2">
            {claims.map((claim) => (
              <li
                key={claim.id}
                className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                  claim.status === "approved"
                    ? "border-forest/25 bg-forest-soft/60 text-forest"
                    : claim.status === "pending"
                      ? "border-amber/30 bg-amber/10 text-amber"
                      : "border-clay/30 bg-clay/10 text-clay"
                }`}
              >
                {claim.status === "approved" ? (
                  <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : claim.status === "pending" ? (
                  <Clock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span>
                  {claim.mission === "app_video" ? "Video about Dishd" : "Video about a kitchen"} —{" "}
                  {claim.status === "pending"
                    ? "waiting for review"
                    : claim.status === "approved"
                      ? "approved, points added"
                      : "declined"}
                  {claim.resolution_note && <> · {claim.resolution_note}</>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* -------------------------------------------------------- ledger */}
        <h2 className="mt-10 font-display text-2xl text-forest">Your points history</h2>
        {events.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface-sunk p-10 text-center text-sm text-ink-muted">
            Nothing yet. Collect a meal from a neighbourhood kitchen to start.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{event.description}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {new Date(event.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`tabular shrink-0 font-display text-lg ${
                    event.points > 0 ? "text-brass-ink" : "text-ink-muted"
                  }`}
                >
                  {event.points > 0 ? `+${event.points}` : event.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
