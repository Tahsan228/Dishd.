import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/market/site-header";
import { DiscoveryClaimsForm, DishDiscoveryForm } from "@/components/market/discovery-settings-form";
import type { MenuDiscoverySettings } from "@/lib/market/discovery-settings";

export const metadata = { title: "Discovery & offers | Dishd" };
export default async function DiscoverySettings() {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fdiscovery");
  const { data: kitchen } = await client.from("kitchens").select("id,name").eq("owner_id", user.id).maybeSingle();
  if (!kitchen) redirect("/cook");
  const [items, claims, details] = await Promise.all([
    client.from("menu_items").select("id,name,contains_meat,price_cents").eq("kitchen_id", kitchen.id).order("name"),
    client.from("kitchen_discovery_claims").select("*").eq("kitchen_id", kitchen.id).maybeSingle(),
    client.from("menu_discovery").select("*,menu_items!inner(kitchen_id)").eq("menu_items.kitchen_id", kitchen.id),
  ]);
  const settings = new Map((details.data ?? []).map(row => [row.menu_item_id, row as MenuDiscoverySettings]));
  return <><SiteHeader /><main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
    <Link href="/cook" className="text-sm text-forest underline">Back to your kitchen</Link>
    <h1 className="mt-5 font-display text-4xl text-forest">Discovery &amp; offers</h1>
    <p className="mt-3 text-sm text-ink-muted">Help neighbors find {kitchen.name} by its food, serving sizes, and your kitchen&apos;s declarations.</p>
    {claims.error || details.error || items.error ? <p role="status" className="mt-6 rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">Discovery settings are being prepared. Please come back shortly.</p> : <div className="mt-8 space-y-6">
      <DiscoveryClaimsForm zabiha={claims.data?.zabiha_claimed === true} noPork={claims.data?.no_pork_claimed === true} />
      <h2 className="pt-3 font-display text-2xl text-forest">Your dishes</h2>
      {(items.data ?? []).map(item => <DishDiscoveryForm key={item.id} item={item} settings={settings.get(item.id)} />)}
      {!items.data?.length && <p className="text-sm text-ink-muted">Add a dish in your kitchen menu first, then return to add its discovery details.</p>}
    </div>}
  </main></>;
}
