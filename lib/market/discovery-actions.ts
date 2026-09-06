"use server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { menuDiscoverySchema, type DiscoveryState } from "@/lib/market/discovery-settings";

const unavailable = { ok: false, message: "Discovery settings are temporarily unavailable. Please try again shortly." };
async function owner() {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: kitchen } = await client.from("kitchens").select("id,slug").eq("owner_id", user.id).maybeSingle();
  return kitchen ? { client, kitchen } : null;
}
function refresh(slug: string) { revalidatePath("/"); revalidatePath("/cook/discovery"); revalidatePath("/k/" + slug); }

export async function saveDiscoveryClaims(_: DiscoveryState, form: FormData): Promise<DiscoveryState> {
  try {
    const context = await owner();
    if (!context) return { ok: false, message: "Sign in as the kitchen owner to edit these details." };
    const { error } = await context.client.from("kitchen_discovery_claims").upsert({ kitchen_id: context.kitchen.id,
      zabiha_claimed: form.get("zabiha_claimed") === "on", no_pork_claimed: form.get("no_pork_claimed") === "on", updated_at: new Date().toISOString() });
    if (error) return unavailable;
    refresh(context.kitchen.slug);
    return { ok: true, message: "Your seller declarations have been saved." };
  } catch { return unavailable; }
}

export async function saveMenuDiscovery(_: DiscoveryState, form: FormData): Promise<DiscoveryState> {
  const parsed = menuDiscoverySchema.safeParse({ menu_item_id: form.get("menu_item_id"), vegetarian_claimed: form.get("vegetarian_claimed") === "on",
    serves: form.get("serves"), meal_tags: form.getAll("meal_tags"), offer_title: form.get("offer_title") ?? "", offer_hours: form.get("offer_hours") ?? 24 });
  if (!parsed.success) return { ok: false, message: "Use 1–30 servings, an offer headline up to 80 characters, and a duration of 1–168 hours." };
  try {
    const context = await owner();
    if (!context) return { ok: false, message: "Sign in as the kitchen owner to edit this dish." };
    const values = parsed.data;
    const { data: item } = await context.client.from("menu_items").select("id,contains_meat").eq("id", values.menu_item_id).eq("kitchen_id", context.kitchen.id).maybeSingle();
    if (!item) return { ok: false, message: "This dish does not belong to your kitchen." };
    if (item.contains_meat && values.vegetarian_claimed) return { ok: false, message: "A dish marked as containing meat cannot also be listed as vegetarian." };
    const { error } = await context.client.from("menu_discovery").upsert({ menu_item_id: item.id, vegetarian_claimed: values.vegetarian_claimed,
      serves: values.serves, meal_tags: values.meal_tags, offer_title: values.offer_title || null,
      offer_expires_at: values.offer_title ? new Date(Date.now() + values.offer_hours * 3600000).toISOString() : null, updated_at: new Date().toISOString() });
    if (error) return unavailable;
    refresh(context.kitchen.slug);
    return { ok: true, message: "Dish details saved. Any offer starts now and ends after your chosen duration." };
  } catch { return unavailable; }
}
