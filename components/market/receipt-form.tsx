"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, TriangleAlert, Wand2, XCircle } from "lucide-react";
import { submitReceipt, type SubmitReceiptResult } from "@/lib/market/receipt-actions";
import { MEAT_TYPES } from "@/lib/market/cook-onboarding";
import { cn } from "@/lib/utils";
import { downscaleImage, requestTooLargeMessage, wouldExceedRequestLimit } from "@/lib/market/image-downscale";
import { receiptFileError, RECEIPT_ACCEPT } from "@/lib/market/upload-validation";

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

/**
 * The Chain of Trust upload.
 *
 * The cook declares what is on the receipt and attaches the image. Deterministic
 * checks run on the spot and are shown line by line — a duplicate image, a
 * receipt already used by another kitchen, a shop that was never registered, or
 * a date too old all reject immediately with the reason. Anything that passes
 * sits at `pending` until a human confirms the image, which is why the badge on
 * the menu says pending in amber rather than claiming verification.
 */
export function ReceiptForm({
  kitchenId,
  sources,
}: {
  kitchenId: string;
  sources: { id: string; store_name: string }[];
}) {
  const [result, setResult] = useState<SubmitReceiptResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const [v, setV] = useState({
    halalSourceId: sources[0]?.id ?? "",
    storeName: sources[0]?.store_name ?? "",
    purchaseDate: "",
    totalDollars: "",
    meatTypes: [] as string[],
  });

  const toggleMeat = (m: string) =>
    setV({
      ...v,
      meatTypes: v.meatTypes.includes(m)
        ? v.meatTypes.filter((x) => x !== m)
        : [...v.meatTypes, m],
    });

  function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const file = form.get("receipt");
    const problem = receiptFileError(file instanceof File ? file : null);
    if (problem) { setResult({ ok: false, status: "mismatch", checks: [], message: problem }); return; }
    start(async () => {
      try {
        // Shrunk here rather than on the server: the host rejects an oversized
        // request body before any of our code runs, so a full-resolution phone
        // photo has to become smaller in the browser or never arrive at all.
        if (file instanceof File) {
          const smaller = await downscaleImage(file);
          if (wouldExceedRequestLimit([smaller])) {
            setResult({ ok: false, status: "mismatch", checks: [], message: requestTooLargeMessage(false) });
            return;
          }
          form.set("receipt", smaller, smaller.name);
        }
        const r = await submitReceipt(kitchenId, form);
        setResult(r);
        if (r.ok) router.refresh();
      } catch {
        setResult({ ok: false, status: "mismatch", checks: [], message: "The receipt could not be submitted. Your details are still here. Check your connection and try a file under 8 MB." });
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-sunk p-4 text-xs leading-relaxed text-ink-muted">
        Declare what the receipt says, then attach the photo. Four checks run
        instantly and reject on the spot: a duplicate image, a receipt already
        claimed by another kitchen, a shop you never registered, and a purchase
        older than a week. What passes waits for a reviewer to confirm the image.
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setV({
              halalSourceId: sources[0]?.id ?? "",
              storeName: sources[0]?.store_name ?? "Al-Salam Halal Meats",
              purchaseDate: today,
              totalDollars: "86.40",
              meatTypes: ["chicken"],
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1.5 text-xs font-medium text-brass-ink hover:bg-brass/20"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          Fill for the demo
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink">Which registered shop?</span>
        <select
          name="halalSourceId"
          value={v.halalSourceId}
          onChange={(e) => {
            const source = sources.find((s) => s.id === e.target.value);
            setV({ ...v, halalSourceId: e.target.value, storeName: source?.store_name ?? v.storeName });
          }}
          className={field}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.store_name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Shop name as printed on the receipt</span>
        <input name="storeName" required value={v.storeName} onChange={(e) => setV({ ...v, storeName: e.target.value })} className={field} />
        <span className="mt-1 block text-xs text-ink-muted">
          This is matched against your registered suppliers.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-ink">Purchase date</span>
          <input name="purchaseDate" type="date" required max={today} value={v.purchaseDate} onChange={(e) => setV({ ...v, purchaseDate: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink">Total on the receipt (USD)</span>
          <input name="totalDollars" required inputMode="decimal" value={v.totalDollars} onChange={(e) => setV({ ...v, totalDollars: e.target.value })} className={field} />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-ink">What meat did this cover?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEAT_TYPES.map((m) => (
            <label
              key={m}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-xs capitalize",
                v.meatTypes.includes(m)
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              <input
                type="checkbox"
                name="meatTypes"
                value={m}
                checked={v.meatTypes.includes(m)}
                onChange={() => toggleMeat(m)}
                className="sr-only"
              />
              {m}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-medium text-ink">Photo of the receipt</span>
        <input
          name="receipt"
          type="file"
          accept={RECEIPT_ACCEPT}
          required
          className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-cream hover:file:bg-forest-deep"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Image or PDF, up to 8 MB. Stored privately for sourcing review.
        </span>
      </label>

      {result && (
        <div
          className={cn(
            "rise rounded-xl border p-4",
            result.ok
              ? "border-amber/40 bg-amber/10"
              : "border-clay/30 bg-clay/10",
          )}
        >
          <p
            className={cn(
              "flex items-start gap-2 text-sm font-medium",
              result.ok ? "text-amber" : "text-clay",
            )}
          >
            {result.ok ? (
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{result.message}</span>
          </p>

          {result.checks.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
              {result.checks.map((check) => (
                <li key={check.code} className="flex items-start gap-2 text-xs">
                  {check.passed ? (
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
                  ) : (
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-clay" aria-hidden />
                  )}
                  <span className={check.passed ? "text-ink-muted" : "text-clay"}>
                    {check.label}
                    {!check.passed && check.detail && <> — {check.detail}</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
      >
        {pending ? "Running checks…" : "Submit receipt"}
      </button>
    </form>
  );
}
