"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, TriangleAlert, Wand2 } from "lucide-react";
import {
  addHalalSource,
  addMenuItem,
  claimPermit,
  createKitchen,
} from "@/lib/market/cook-actions";
import {
  ALLERGENS,
  COUNTIES,
  MEAT_TYPES,
  type CookActionState,
} from "@/lib/market/cook-onboarding";
import { cn } from "@/lib/utils";

const initial: CookActionState = { ok: false, message: "" };

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

function Feedback({ state }: { state: CookActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={cn(
        "rise mt-3 flex items-start gap-2 rounded-lg p-3 text-xs",
        state.ok
          ? "border border-forest/30 bg-forest-soft text-forest"
          : "border border-clay/30 bg-clay/10 text-clay",
      )}
    >
      {state.ok ? (
        <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span>{state.message}</span>
    </p>
  );
}

function Err({ state, name }: { state: CookActionState; name: string }) {
  const message = state.errors?.[name];
  if (!message) return null;
  return <span className="mt-1 block text-xs text-clay">{message}</span>;
}

/**
 * "Fill for the demo" buttons.
 *
 * Every step still runs its real validation, its real server action and its
 * real database write — this only types plausible answers into the form so a
 * walkthrough does not stall on inventing an address. Nothing is skipped.
 */
function DemoFill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1.5 text-xs font-medium text-brass-ink hover:bg-brass/20"
    >
      <Wand2 className="h-3.5 w-3.5" aria-hidden />
      Fill for the demo
    </button>
  );
}

/* ------------------------------------------------------------------ step 1 */

export function KitchenForm() {
  const [state, action, pending] = useActionState(createKitchen, initial);
  const [v, setV] = useState({
    name: "",
    bio: "",
    cuisineTags: "",
    line1: "",
    line2: "",
    city: "",
    zip: "",
    county: COUNTIES[0].county,
  });

  return (
    <form action={action} className="space-y-4">
      <div className="flex justify-end">
        <DemoFill
          onClick={() =>
            setV({
              name: "Sabiha's Kitchen",
              bio: "Home-style Bengali cooking, slow-braised and cooked to order for pickup.",
              cuisineTags: "bengali, halal, home-style",
              line1: "412 Peralta Boulevard",
              line2: "Apt 3",
              city: "Fremont",
              zip: "94536",
              county: "Alameda",
            })
          }
        />
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink">Kitchen name</span>
        <input name="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={field} />
        <Err state={state} name="name" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">About your cooking <span className="font-normal text-ink-muted">(optional)</span></span>
        <textarea name="bio" rows={3} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} className={cn(field, "resize-y")} />
        <Err state={state} name="bio" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Cuisine tags</span>
        <input name="cuisineTags" placeholder="bengali, halal" value={v.cuisineTags} onChange={(e) => setV({ ...v, cuisineTags: e.target.value })} className={field} />
        <span className="mt-1 block text-xs text-ink-muted">Comma separated, up to six.</span>
      </label>

      <fieldset className="rounded-xl border border-line bg-surface-sunk p-4">
        <legend className="px-1 text-xs font-medium text-ink">Where you cook</legend>
        <p className="mb-3 text-xs leading-relaxed text-ink-muted">
          Your exact address is private. Buyers see a fuzzed neighbourhood pin
          until you accept their order — the public point is generated from your
          city, never from this address.
        </p>

        <label className="block">
          <span className="text-xs font-medium text-ink">Street address</span>
          <input name="line1" required value={v.line1} onChange={(e) => setV({ ...v, line1: e.target.value })} className={field} />
          <Err state={state} name="line1" />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-ink">Apartment <span className="font-normal text-ink-muted">(optional)</span></span>
          <input name="line2" value={v.line2} onChange={(e) => setV({ ...v, line2: e.target.value })} className={field} />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink">City</span>
            <input name="city" required value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} className={field} />
            <Err state={state} name="city" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink">ZIP</span>
            <input name="zip" required inputMode="numeric" value={v.zip} onChange={(e) => setV({ ...v, zip: e.target.value })} className={field} />
            <Err state={state} name="zip" />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-ink">County</span>
          <select name="county" value={v.county} onChange={(e) => setV({ ...v, county: e.target.value })} className={field}>
            {COUNTIES.map((c) => (
              <option key={c.county} value={c.county}>{c.county} County, {c.stateCode}</option>
            ))}
          </select>
          <input
            type="hidden"
            name="stateCode"
            value={COUNTIES.find((c) => c.county === v.county)?.stateCode ?? "CA"}
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Dishd only operates where it understands the cottage-food rules.
          </span>
        </label>
      </fieldset>

      <Feedback state={state} />
      <SubmitButton pending={pending} label="Create my kitchen" />
    </form>
  );
}

/* ------------------------------------------------------------------ step 2 */

export function PermitForm() {
  const [state, action, pending] = useActionState(claimPermit, initial);
  const [permitNo, setPermitNo] = useState("");

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl border border-amber/30 bg-amber/10 p-4 text-xs leading-relaxed text-ink">
        A MEHKO permit is issued by your county health department and is what
        makes selling food cooked at home legal. Dishd records the number you
        enter as <strong>claimed</strong>. It becomes <strong>verified</strong>{" "}
        only after a reviewer checks it against the county register — the
        verified mark on your page means that check happened.
      </div>

      <div className="flex justify-end">
        <DemoFill onClick={() => setPermitNo("MEHKO-ALA-2026-4417")} />
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink">Permit number</span>
        <input name="permitNo" required value={permitNo} onChange={(e) => setPermitNo(e.target.value)} className={field} />
        <Err state={state} name="permitNo" />
      </label>

      <Feedback state={state} />
      <SubmitButton pending={pending} label="Record my permit" />
    </form>
  );
}

/* ------------------------------------------------------------------ step 3 */

export function SourceForm() {
  const [state, action, pending] = useActionState(addHalalSource, initial);
  const [v, setV] = useState({ storeName: "", storeAddress: "", certBody: "" });

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-sunk p-4 text-xs leading-relaxed text-ink-muted">
        Register every shop you buy meat from. When you upload a receipt, the
        store on it is matched against this list — a receipt from a shop you
        never registered is rejected automatically, which is the check that
        makes the Chain of Trust worth anything.
      </div>

      <div className="flex justify-end">
        <DemoFill
          onClick={() =>
            setV({
              storeName: "Al-Salam Halal Meats",
              storeAddress: "39200 Paseo Padre Pkwy, Fremont, CA",
              certBody: "HFSAA",
            })
          }
        />
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink">Shop name</span>
        <input name="storeName" required value={v.storeName} onChange={(e) => setV({ ...v, storeName: e.target.value })} className={field} />
        <Err state={state} name="storeName" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Shop address <span className="font-normal text-ink-muted">(optional)</span></span>
        <input name="storeAddress" value={v.storeAddress} onChange={(e) => setV({ ...v, storeAddress: e.target.value })} className={field} />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Certifying body <span className="font-normal text-ink-muted">(optional)</span></span>
        <input name="certBody" placeholder="HFSAA, IFANCA…" value={v.certBody} onChange={(e) => setV({ ...v, certBody: e.target.value })} className={field} />
      </label>

      <Feedback state={state} />
      <SubmitButton pending={pending} label="Register this supplier" />
    </form>
  );
}

/* ------------------------------------------------------------------ step 5 */

export function MenuItemForm({
  batches,
}: {
  batches: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addMenuItem, initial);
  const [v, setV] = useState({
    name: "",
    description: "",
    price: "",
    containsMeat: false,
    meatType: "chicken",
    batchId: batches[0]?.id ?? "",
    allergens: [] as string[],
  });

  const toggleAllergen = (a: string) =>
    setV({
      ...v,
      allergens: v.allergens.includes(a)
        ? v.allergens.filter((x) => x !== a)
        : [...v.allergens, a],
    });

  return (
    <form action={action} className="space-y-4">
      <div className="flex justify-end">
        <DemoFill
          onClick={() =>
            setV({
              name: "Chicken biryani",
              description: "Basmati layered with slow-cooked chicken, saffron and fried onion.",
              price: "14.00",
              containsMeat: true,
              meatType: "chicken",
              batchId: batches[0]?.id ?? "",
              allergens: ["dairy", "tree_nuts"],
            })
          }
        />
      </div>

      <label className="block">
        <span className="text-xs font-medium text-ink">Dish name</span>
        <input name="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={field} />
        <Err state={state} name="name" />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Description</span>
        <textarea name="description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={cn(field, "resize-y")} />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink">Price (USD)</span>
        <input name="price" required inputMode="decimal" placeholder="14.00" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className={field} />
        <Err state={state} name="price" />
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface-sunk p-4 text-xs leading-relaxed">
        <input
          type="checkbox"
          name="containsMeat"
          checked={v.containsMeat}
          onChange={(e) => setV({ ...v, containsMeat: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-forest)]"
        />
        <span className="text-ink">
          This dish contains meat.
          <span className="mt-0.5 block text-ink-muted">
            A meat dish cannot go on sale without a sourcing receipt behind it.
            The database refuses the row, not just the form.
          </span>
        </span>
      </label>

      {v.containsMeat && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink">Meat type</span>
            <select name="meatType" value={v.meatType} onChange={(e) => setV({ ...v, meatType: e.target.value })} className={field}>
              {MEAT_TYPES.map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink">Sourcing batch</span>
            <select name="batchId" value={v.batchId} onChange={(e) => setV({ ...v, batchId: e.target.value })} className={field}>
              {batches.length === 0 && <option value="">No receipts uploaded yet</option>}
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <Err state={state} name="batchId" />
          </label>
        </div>
      )}

      {!v.containsMeat && <input type="hidden" name="meatType" value="none" />}

      <fieldset>
        <legend className="text-xs font-medium text-ink">Allergens</legend>
        <p className="mt-1 text-xs text-ink-muted">
          Declare everything present. Cross-contamination is assumed in a home
          kitchen and buyers accept that separately.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <label
              key={a}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-xs capitalize",
                v.allergens.includes(a)
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-ink-muted hover:border-forest/40",
              )}
            >
              <input
                type="checkbox"
                name="allergens"
                value={a}
                checked={v.allergens.includes(a)}
                onChange={() => toggleAllergen(a)}
                className="sr-only"
              />
              {a.replace("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <Feedback state={state} />
      <SubmitButton pending={pending} label="Add this dish" />
    </form>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 w-full rounded-full bg-forest px-5 text-sm font-medium text-cream hover:bg-forest-deep disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
