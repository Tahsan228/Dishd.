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
  const { score, tier } = counters
    ? scoreBuyer(counters)
    : { score: 0, tier: "newcomer" as const };

  const stats = [
    { label: "Meals logged", value: counters?.verified_logs ?? 0, icon: Utensils },
    { label: "Kitchens tried", value: counters?.distinct_kitchens ?? 0, icon: MapPin },
    { label: "Reviews written", value: counters?.substantive_reviews ?? 0, icon: Star },
  ];

  const initial = (profile.display_name || profile.handle).charAt(0).toUpperCase();

  return (
    <section className="rise mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-forest font-display text-2xl text-cream"
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>

          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Welcome back</p>
            <h2 className="truncate font-display text-2xl leading-tight text-forest">
              {profile.display_name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
              <span>@{profile.handle}</span>
              <span aria-hidden>·</span>
              {/* Brass is the earned colour, and brass-ink is the readable
                  weight of it at this size. */}
              <span className="font-medium text-brass-ink">{tierLabel(tier)}</span>
              <span aria-hidden>·</span>
              <span className="tabular">{score} pts</span>
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
          <div key={label} className="px-3 py-3.5 text-center sm:px-4">
            <dt className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="tabular mt-1 font-display text-2xl text-forest">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
