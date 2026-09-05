import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Lock } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import {
  KitchenForm,
  MenuItemForm,
  PermitForm,
  SourceForm,
} from "@/components/market/cook-onboarding-forms";
import { ReceiptForm } from "@/components/market/receipt-form";
import { GoLiveButton } from "@/components/market/go-live-button";
import {
  ONBOARDING_STEPS,
  completedCount,
  currentStep,
  stepIsDone,
  type OnboardingProgress,
} from "@/lib/market/cook-onboarding";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up your kitchen · Dishd" };

export default async function CookStartPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/signin?next=%2Fcook%2Fstart");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fstart");

  const { data: kitchen } = await supabase
    .from("kitchens")
    .select("id, name, slug, status, permit_status, county, state_code")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Each step's completion is read from the thing it actually created, so
  // progress survives a refresh, a new device, and coming back a week later.
  const [sources, batches, items] = kitchen
    ? await Promise.all([
        supabase.from("halal_sources").select("id, store_name").eq("kitchen_id", kitchen.id),
        supabase
          .from("sourcing_batches")
          .select("id, ocr_store, ocr_date, match_status")
          .eq("kitchen_id", kitchen.id)
          .order("created_at", { ascending: false }),
        supabase.from("menu_items").select("id, name").eq("kitchen_id", kitchen.id),
      ])
    : [null, null, null];

  const progress: OnboardingProgress = {
    hasKitchen: Boolean(kitchen),
    hasPermit: (kitchen?.permit_status ?? "none") !== "none",
    hasSource: (sources?.data?.length ?? 0) > 0,
    hasBatch: (batches?.data?.length ?? 0) > 0,
    hasMenuItem: (items?.data?.length ?? 0) > 0,
    isLive: kitchen?.status === "active",
  };

  if (progress.isLive) redirect("/cook");

  const step = currentStep(progress);
  const done = completedCount(progress);

  const batchOptions = (batches?.data ?? []).map((b) => ({
    id: b.id as string,
    label: `${b.ocr_store ?? "Receipt"} · ${b.ocr_date ?? "undated"} · ${b.match_status}`,
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="font-display text-3xl text-forest">Set up your kitchen</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Six steps, in this order because the rules require it. Nothing here is
          skippable — but every step has a &ldquo;fill for the demo&rdquo; button
          so you can walk it quickly.
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>
              Step <span className="tabular">{done + 1}</span> of{" "}
              <span className="tabular">{ONBOARDING_STEPS.length}</span>
            </span>
            <span className="tabular">{Math.round((done / ONBOARDING_STEPS.length) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
            <div
              className="h-full rounded-full bg-forest transition-[width]"
              style={{ width: `${(done / ONBOARDING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {ONBOARDING_STEPS.map((s, i) => {
            const isDone = stepIsDone(progress, s.key);
            const isCurrent = s.key === step;
            return (
              <li
                key={s.key}
                className={cn(
                  "rounded-2xl border",
                  isCurrent
                    ? "border-forest bg-surface"
                    : isDone
                      ? "border-line bg-surface"
                      : "border-line bg-surface opacity-60",
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs",
                      isDone
                        ? "bg-forest text-cream"
                        : isCurrent
                          ? "bg-forest text-cream"
                          : "bg-surface-sunk text-ink-muted",
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-medium text-ink">{s.title}</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{s.blurb}</p>

                    {isCurrent && (
                      <div className="mt-4 border-t border-line pt-4">
                        {s.key === "kitchen" && <KitchenForm />}
                        {s.key === "permit" && (
                          <PermitForm
                            county={kitchen?.county ?? ""}
                            stateCode={kitchen?.state_code ?? ""}
                          />
                        )}
                        {s.key === "sources" && <SourceForm />}
                        {s.key === "receipt" && kitchen && (
                          <ReceiptForm
                            kitchenId={kitchen.id}
                            sources={(sources?.data ?? []) as { id: string; store_name: string }[]}
                          />
                        )}
                        {s.key === "menu" && <MenuItemForm batches={batchOptions} />}
                        {s.key === "live" && <GoLiveButton kitchenName={kitchen?.name ?? "your kitchen"} />}
                      </div>
                    )}

                    {!isDone && !isCurrent && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <Lock className="h-3 w-3" aria-hidden />
                        Finish the step above first
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {kitchen && (
          <p className="mt-6 text-center text-xs text-ink-muted">
            Your kitchen is a draft — nobody can order from it yet.{" "}
            <Link href="/cook" className="text-forest underline underline-offset-2">
              Go to your dashboard
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
