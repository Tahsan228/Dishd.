import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { scoreKitchen, tierLabel } from "@/lib/social/credibility";
import { formatDate, formatNumber, KITCHEN_COUNTER_COLUMNS, socialClient, type KitchenSummary } from "@/lib/social/data";
import { toStars } from "@/lib/utils";
import { PrintRecordButton } from "@/components/social/print-record-button";
import { SocialNotice } from "@/components/social/social-notice";

export const metadata = { title: "Business Record · Dishd" };

export default async function BusinessRecordPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await socialClient();
  if (!supabase) return <main className="mx-auto max-w-3xl p-5"><SocialNotice title="Business Record unavailable">Kitchen records will appear when Dishd is connected.</SocialNotice></main>;
  const { data, error } = await supabase.from("kitchens")
    .select(`id,name,slug,status,neighborhood_label,county,state_code,${KITCHEN_COUNTER_COLUMNS}`).eq("slug", slug).maybeSingle();
  if (error) return <main className="mx-auto max-w-3xl p-5"><SocialNotice title="Record unavailable">We couldn’t load this kitchen’s record. Please try again shortly.</SocialNotice></main>;
  if (!data) notFound();
  const kitchen = data as unknown as KitchenSummary & { neighborhood_label: string; county: string; state_code: string };
  const now = new Date();
  const credibility = scoreKitchen(kitchen, now);
  const kitchenPath = `/k/${encodeURIComponent(kitchen.slug)}`;
  if (credibility.tier !== "dishd_verified" || kitchen.status !== "active") {
    return <main className="mx-auto max-w-2xl space-y-5 px-5 py-10"><SocialNotice title="A record earned meal by meal">
      <p>The Business Record unlocks at 800 credibility points for active kitchens.</p>
      <p className="mt-3">{kitchen.name} is currently {tierLabel(credibility.tier).toLowerCase()}, with <span className="tabular font-semibold text-forest">{formatNumber(credibility.score)}</span> points.</p>
      {credibility.score < 800 && <p className="mt-2 tabular">{formatNumber(800 - credibility.score)} more points to unlock.</p>}
      {kitchen.status !== "active" && <p className="mt-2 text-clay">This kitchen is currently {kitchen.status}.</p>}
    </SocialNotice><Link href={kitchenPath} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline underline-offset-4">Back to the kitchen</Link></main>;
  }
  const repeatRate = kitchen.distinct_customers > 0 ? kitchen.repeat_customers / kitchen.distinct_customers * 100 : null;
  const metrics = [
    { label: "Verified orders fulfilled", value: formatNumber(kitchen.orders_completed), detail: "Completed pickups recorded on Dishd" },
    { label: "Returning customer rate", value: repeatRate === null ? "—" : `${formatNumber(repeatRate)}%`, detail: `${formatNumber(kitchen.repeat_customers)} of ${formatNumber(kitchen.distinct_customers)} customers returned` },
    { label: "Average meal rating", value: `${toStars(kitchen.avg_rating_10).toFixed(1)} / 5`, detail: "Average of rated diary entries" },
    { label: "Verified sourcing streak", value: formatNumber(kitchen.trust_streak), detail: "Consecutive verified batches; pending reviews excluded" },
    { label: "Revenue", value: "Not available", detail: "Revenue has not been supplied for this record" },
    { label: "Months of clean operation", value: "Not verified", detail: "Historical clearance dates are not available" },
  ];

  return <main className="mx-auto max-w-3xl px-5 py-8 print:max-w-none print:p-0">
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4"><Link href={kitchenPath} className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4">Back to {kitchen.name}</Link><PrintRecordButton /></div>
    <article aria-label={`${kitchen.name} Business Record`} className="rounded-sm border border-line bg-surface p-5 text-ink sm:p-10 print:border-0 print:p-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-forest pb-6">
        <div><p className="font-display text-4xl text-forest">dishd<span className="text-brass">.</span></p><p className="mt-2 text-xs uppercase tracking-widest text-ink-muted">A reputation you can take with you</p></div>
        <div className="text-xs leading-relaxed text-ink-muted sm:text-right"><p>Issued {formatDate(now.toISOString())}</p><p>Public activity snapshot</p></div>
      </header>
      <div className="py-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-brass-ink">Business Record</p>
        <h1 className="mt-3 break-words font-display text-4xl text-forest sm:text-5xl">{kitchen.name}</h1>
        <p className="mt-3 text-sm text-ink-muted">{kitchen.neighborhood_label} · {kitchen.county}, {kitchen.state_code}</p>
        <p className="mt-1 text-xs text-ink-muted">On Dishd since {formatDate(kitchen.created_at)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-forest bg-forest-soft p-4 print:break-inside-avoid">
        <div className="flex items-center gap-3"><BadgeCheck aria-hidden="true" className="size-9 text-forest" /><div><p className="font-display text-xl text-forest">Dishd verified</p><p className="text-xs text-ink-muted">Earned kitchen credibility tier</p></div></div>
        <p className="tabular font-display text-3xl text-forest">{formatNumber(credibility.score)} <span className="font-sans text-xs">points</span></p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6 print:break-inside-avoid">
        {metrics.map((metric) => <div key={metric.label} className="min-w-0 border-t border-line pt-4"><dt className="text-xs font-medium text-ink-muted">{metric.label}</dt><dd className="tabular mt-2 break-words font-display text-2xl text-forest sm:text-3xl">{metric.value}</dd><dd className="mt-1 text-xs leading-relaxed text-ink-muted">{metric.detail}</dd></div>)}
      </dl>
      <section className="mt-7 border-t border-line pt-5 print:break-inside-avoid">
        <h2 className="font-display text-lg">Current standing</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">Permit: {kitchen.permit_status}. Open incidents: <span className="tabular">{kitchen.open_incidents}</span>. Upheld flags: <span className="tabular">{kitchen.upheld_flags}</span>. Cook cancellations: <span className="tabular">{kitchen.cook_cancellations}</span>.</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">This record reports activity recorded on Dishd as of the issue date. Revenue and the duration of clean operation are not verified in this snapshot. Current incident counts do not establish a clean historical period.</p>
      </section>
      <footer className="mt-6 border-t border-forest pt-4 text-xs leading-relaxed text-ink-muted print:break-inside-avoid"><p className="font-medium text-forest">Built through real pickups, returning neighbors, and sourcing evidence.</p><p className="mt-2 break-all">Record ID: {kitchen.id}</p><p className="break-all">Current record: /k/{kitchen.slug}/record</p></footer>
    </article>
  </main>;
}
