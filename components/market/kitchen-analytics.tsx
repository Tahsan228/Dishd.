import { Eye, MousePointerClick, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import {
  barPercent,
  buildSeries,
  conversionPercent,
  dayLabel,
  seriesMax,
  seriesTotal,
  trendPercent,
  type DayPoint,
  type SeriesKey,
} from "@/lib/market/analytics";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";

const WINDOW_DAYS = 14;

/**
 * Views, menu interest, orders and revenue over the last fortnight.
 *
 * Drawn as bars in plain markup rather than with a charting library. Each
 * series keeps its own scale, because views outnumber orders by an order of
 * magnitude and putting them on one axis would flatten orders into nothing.
 */
export async function KitchenAnalytics({ kitchenId }: { kitchenId: string }) {
  const supabase = await createServerClient();
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [viewsResult, ordersResult] = await Promise.all([
    supabase
      .from("kitchen_daily_stats")
      .select("day, page_views, menu_clicks")
      .eq("kitchen_id", kitchenId),
    supabase
      .from("orders")
      .select("created_at, subtotal_cents, status")
      .eq("kitchen_id", kitchenId)
      .gte("created_at", since.toISOString()),
  ]);

  const points = buildSeries(
    WINDOW_DAYS,
    (viewsResult.data ?? []) as { day: string; page_views: number; menu_clicks: number }[],
    (ordersResult.data ?? []) as { created_at: string; subtotal_cents: number; status: string }[],
  );

  const cards: {
    key: SeriesKey;
    label: string;
    icon: typeof Eye;
    format: (n: number) => string;
  }[] = [
    { key: "pageViews", label: "Page views", icon: Eye, format: String },
    { key: "menuClicks", label: "Menu interest", icon: MousePointerClick, format: String },
    { key: "orders", label: "Orders", icon: Receipt, format: String },
    { key: "revenueCents", label: "Revenue", icon: Receipt, format: formatCents },
  ];

  const conversion = conversionPercent(points);
  const hasAnything = cards.some((c) => seriesTotal(points, c.key) > 0);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-forest">Last {WINDOW_DAYS} days</h2>
        {conversion !== null && (
          <p className="tabular text-xs text-ink-muted">
            {conversion}% of page views became an order
          </p>
        )}
      </div>

      {!hasAnything ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-sunk p-8 text-center text-sm text-ink-muted">
          Nothing to chart yet. Views and orders appear here as they happen.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <Chart
              key={card.key}
              points={points}
              seriesKey={card.key}
              label={card.label}
              icon={card.icon}
              format={card.format}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Views are counted when someone opens your kitchen page. They inform your
        own decisions and are never used for credibility, ranking or money.
      </p>
    </section>
  );
}

function Chart({
  points,
  seriesKey,
  label,
  icon: Icon,
  format,
}: {
  points: DayPoint[];
  seriesKey: SeriesKey;
  label: string;
  icon: typeof Eye;
  format: (n: number) => string;
}) {
  const max = seriesMax(points, seriesKey);
  const total = seriesTotal(points, seriesKey);
  const trend = trendPercent(points, seriesKey);

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4">
      <figcaption className="flex items-start justify-between gap-3">
        <span>
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </span>
          <span className="tabular mt-1 block font-display text-2xl text-forest">
            {format(total)}
          </span>
        </span>

        {trend !== null && (
          <span
            className={cn(
              "tabular flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
              trend >= 0 ? "bg-forest-soft text-forest" : "bg-clay/10 text-clay",
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden />
            )}
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </figcaption>

      {/* A list of bars, so the shape is available to a screen reader as
          numbers rather than as an image with no alternative. */}
      <ul className="mt-4 flex h-20 items-end gap-1" role="list">
        {points.map((point) => {
          const value = point[seriesKey];
          const height = barPercent(value, max);
          return (
            <li key={point.day} className="flex h-full flex-1 flex-col justify-end">
              <span
                title={`${point.day}: ${format(value)}`}
                style={{ height: `${height}%` }}
                className={cn(
                  "block w-full rounded-t-sm transition-[height] duration-500",
                  value > 0 ? "bg-forest" : "bg-surface-sunk",
                )}
              >
                <span className="sr-only">
                  {point.day}: {format(value)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div aria-hidden className="mt-1.5 flex gap-1">
        {points.map((point) => (
          <span key={point.day} className="flex-1 text-center text-[9px] text-ink-muted">
            {dayLabel(point.day)}
          </span>
        ))}
      </div>
    </figure>
  );
}
