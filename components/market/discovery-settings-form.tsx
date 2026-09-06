"use client";
import { useActionState } from "react";
import { saveDiscoveryClaims, saveMenuDiscovery } from "@/lib/market/discovery-actions";
import { MEAL_TAGS, type MenuDiscoverySettings } from "@/lib/market/discovery-settings";
import { formatCents } from "@/lib/utils";

const initial = { ok: false, message: "" };
const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-line bg-cream px-3 text-base";
function SaveButton({ pending }: { pending: boolean }) { return <button disabled={pending} className="mt-5 min-h-11 rounded-full bg-forest px-5 text-sm font-medium text-cream disabled:opacity-50">{pending ? "Saving…" : "Save details"}</button>; }

export function DiscoveryClaimsForm({ zabiha, noPork }: { zabiha: boolean; noPork: boolean }) {
  const [state, action, pending] = useActionState(saveDiscoveryClaims, initial);
  return <form action={action} className="rounded-2xl border border-line bg-surface p-6">
    <h2 className="font-display text-2xl text-forest">Your kitchen declarations</h2>
    <p className="mt-2 text-sm text-ink-muted">These appear as claims made by your kitchen. Dishd does not certify hand slaughter or food handling.</p>
    <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="zabiha_claimed" defaultChecked={zabiha} className="h-5 w-5 accent-forest" />Our meat is hand-slaughtered / Zabiha.</label>
    <label className="mt-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="no_pork_claimed" defaultChecked={noPork} className="h-5 w-5 accent-forest" />No pork is handled in this kitchen.</label>
    <SaveButton pending={pending} /><p role="status" className="mt-3 text-sm text-ink-muted">{state.message}</p>
  </form>;
}

export function DishDiscoveryForm({ item, settings }: { item: { id: string; name: string; contains_meat: boolean; price_cents: number }; settings?: MenuDiscoverySettings }) {
  const [state, action, pending] = useActionState(saveMenuDiscovery, initial);
  return <form action={action} className="rounded-2xl border border-line bg-surface p-6">
    <input type="hidden" name="menu_item_id" value={item.id} />
    <h3 className="font-sans text-xl font-semibold text-forest">{item.name}<span className="ml-3 text-base font-normal">{formatCents(item.price_cents)}</span></h3>
    <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="vegetarian_claimed" disabled={item.contains_meat} defaultChecked={!item.contains_meat && settings?.vegetarian_claimed} className="h-5 w-5 accent-forest" />Vegetarian, as declared by our kitchen{item.contains_meat ? " (contains meat)" : ""}</label>
    <label className="mt-4 block text-sm font-medium">Number of people this portion serves<input type="number" name="serves" min={1} max={30} required defaultValue={settings?.serves ?? 1} className={inputClass} /></label>
    <fieldset className="mt-5"><legend className="text-sm font-medium">Meal occasions</legend><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{MEAL_TAGS.map(tag => <label key={tag.key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="meal_tags" value={tag.key} defaultChecked={settings?.meal_tags.includes(tag.key)} className="h-5 w-5 accent-forest" />{tag.label}</label>)}</div></fieldset>
    <label className="mt-4 block text-sm font-medium">Offer headline (optional)<input name="offer_title" maxLength={80} defaultValue={settings?.offer_title ?? ""} placeholder="Tonight’s family supper special" className={inputClass} /></label>
    <p className="mt-2 text-xs text-ink-muted">Your current menu price is shown with this headline. Set the price in your menu before advertising a discount. Leave the headline empty to end an offer.</p>
    <label className="mt-4 block text-sm font-medium">Offer duration after saving<select name="offer_hours" defaultValue="24" className={inputClass}><option value="4">4 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label>
    {settings?.offer_expires_at && <p className="mt-2 text-xs text-ink-muted">Saved offer ends {new Date(settings.offer_expires_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Eastern.</p>}
    <SaveButton pending={pending} /><p role="status" className="mt-3 text-sm text-ink-muted">{state.message}</p>
  </form>;
}
