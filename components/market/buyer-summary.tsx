import Link from "next/link";
import { ArrowRight, MapPin, Star, Utensils } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { scoreBuyer, tierLabel } from "@/lib/social/credibility";
import type { BuyerCounters, ProfilePublic } from "@/lib/types";

/**
 * The signed-in header on the home page.
 *
 * Reads the `buyer_counters` view rather than aggregating logs — same rule the
 * social workstream follows, and the view is one row keyed by user_id.
 * Everything here is a summary; the full diary, badges and histogram live on
 * the profile, which is what the button goes to.
 */
export async function BuyerSummary({ profile }: { profile: ProfilePublic }) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("buyer_counters")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  const counters = data as BuyerCounters | null;
  return <BuyerSummaryPreview profile={profile} counters={counters} />;
}

/** The same layout renders immediately while the private counters load. */
export function BuyerSummaryPreview({ profile, counters }: { profile: ProfilePublic; counters?: BuyerCounters | null }) {
  const standing = counters ? scoreBuyer(counters) : null;

  const stats = [
    { label: "Meals logged", value: counters?.verified_logs, icon: Utensils },
    { label: "Kitchens tried", value: counters?.distinct_kitchens, icon: MapPin },
    { label: "Reviews written", value: counters?.substantive_reviews, icon: Star },
  ];

  const initial = (profile.display_name || profile.handle).charAt(0).toUpperCase();

  return (
    <section aria-label="Your profile preview" className="rise overflow-hidden rounded-2xl border border-forest/15 bg-surface shadow-sm">
      <div className="flex flex-col gap-5 bg-forest-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-forest font-display text-2xl text-cream ring-4 ring-surface"
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" width={56} height={56} decoding="async" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>

          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Welcome back</p>
            <h2 className="truncate font-display text-2xl leading-tight text-forest">
              {profile.display_name || profile.handle}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span className="break-all">@{profile.handle}</span>
              {standing ? <>
                <span className="rounded-full border border-brass/20 bg-brass/10 px-2.5 py-1 font-medium text-brass-ink">{tierLabel(standing.tier)}</span>
                <span className="tabular">{standing.score.toLocaleString()} credibility score</span>
              </> : <span role="status">{counters === undefined ? "Loading your food diary…" : "Diary stats temporarily unavailable"}</span>}
            </p>
          </div>
        </div>

        <Link
          href={`/u/${profile.handle}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Go to profile
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="px-2 py-4 text-center sm:px-4">
            <dt className="flex flex-col items-center justify-center gap-1.5 text-xs text-ink-muted sm:flex-row">
              <Icon className="h-4 w-4 shrink-0 text-forest" aria-hidden />
              <span>{label}</span>
            </dt>
            <dd className="tabular mt-2 text-2xl font-semibold text-forest">{value?.toLocaleString() ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
