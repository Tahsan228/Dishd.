"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { approxLocation, kitchenSlug } from "@/lib/market/geo";
import {
  addSourceSchema,
  kitchenSchema,
  menuItemSchema,
  permitSchema,
  type CookActionState,
} from "@/lib/market/cook-onboarding";
import { photoExtension, photoFileError } from "@/lib/social/review-validation";
import {
  MAX_PRIORITY_FEE_CENTS,
  PREP_MAX_MINUTES,
  PREP_MIN_MINUTES,
  parsePrepMinutes,
  parsePriorityFeeCents,
} from "@/lib/market/order-timing";

/**
 * Cook onboarding.
 *
 * Each step writes one thing and is separately reversible, because the order
 * matters legally: a kitchen cannot list a meat dish before it has a registered
 * supplier and a receipt behind it, and it cannot go live before it has claimed
 * a permit. The database enforces the important half of that (see the
 * `meat_requires_batch` constraint on menu_items); these actions enforce the
 * rest and explain it.
 */

async function requireUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=%2Fcook%2Fstart");
  return { supabase, user };
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] = issue.message;
  return errors;
}

/** Step 1 — the kitchen and where it cooks from. */
export async function createKitchen(
  _prev: CookActionState,
  form: FormData,
): Promise<CookActionState> {
  const parsed = kitchenSchema.safeParse({
    name: form.get("name") ?? "",
    bio: form.get("bio") ?? "",
    cuisineTags: form.get("cuisineTags") ?? "",
    line1: form.get("line1") ?? "",
    line2: form.get("line2") ?? "",
    city: form.get("city") ?? "",
    zip: form.get("zip") ?? "",
    county: form.get("county") ?? "",
    stateCode: form.get("stateCode") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error.issues) };
  }

  const { supabase, user } = await requireUser();
  const v = parsed.data;

  const { data: existing } = await supabase
    .from("kitchens")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, message: "You already have a kitchen." };

  // The public pin is fuzzed from the city centre, never from the address —
  // see lib/market/geo.ts. It is written once and never recomputed.
  const seed = `${user.id}:${v.name}`;
  const { lat, lng } = approxLocation(v.city, seed);

  const { data: kitchen, error } = await supabase
    .from("kitchens")
    .insert({
      owner_id: user.id,
      name: v.name,
      slug: kitchenSlug(v.name, seed),
      bio: v.bio || null,
      cuisine_tags: v.cuisineTags,
      state_code: v.stateCode,
      county: v.county,
      neighborhood_label: `${v.city}, ${v.stateCode}`,
      approx_lat: lat,
      approx_lng: lng,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !kitchen) {
    return { ok: false, message: error?.message ?? "Could not create your kitchen." };
  }

  const { error: addressError } = await supabase.from("kitchen_addresses").insert({
    kitchen_id: kitchen.id,
    line1: v.line1,
    line2: v.line2 || null,
    city: v.city,
    zip: v.zip,
    // The private row holds the pin the cook will see; exact geocoding is not
    // needed for pickup, and storing a precise point we never verified would be
    // worse than storing none.
    lat,
    lng,
  });
  if (addressError) return { ok: false, message: addressError.message };

  revalidatePath("/cook");
  return { ok: true, message: "Kitchen created." };
}

/** Step 2 — the home-kitchen permit claim. The programme differs by state. */
export async function claimPermit(
  _prev: CookActionState,
  form: FormData,
): Promise<CookActionState> {
  const parsed = permitSchema.safeParse({ permitNo: form.get("permitNo") ?? "" });
  if (!parsed.success) {
    return { ok: false, message: "Check the permit number.", errors: fieldErrors(parsed.error.issues) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("kitchens")
    .update({ mehko_permit_no: parsed.data.permitNo, permit_status: "claimed" })
    .eq("owner_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook");
  return {
    ok: true,
    message: "Permit recorded as claimed. A reviewer confirms it against the county register.",
  };
}

/** Step 3 — register a halal supplier. Receipts are matched against these. */
export async function addHalalSource(
  _prev: CookActionState,
  form: FormData,
): Promise<CookActionState> {
  const parsed = addSourceSchema.safeParse({
    storeName: form.get("storeName") ?? "",
    storeAddress: form.get("storeAddress") ?? "",
    certBody: form.get("certBody") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the supplier details.", errors: fieldErrors(parsed.error.issues) };
  }

  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "Create your kitchen first." };

  const { error } = await supabase.from("halal_sources").insert({
    kitchen_id: kitchen.id,
    store_name: parsed.data.storeName,
    store_address: parsed.data.storeAddress || null,
    cert_body: parsed.data.certBody || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook/start");
  return { ok: true, message: `${parsed.data.storeName} registered.` };
}

/**
 * Add a dish. Meat needs a verified batch; the database agrees.
 *
 * Calories and ingredients are recorded as the cook's own claim and shown to
 * buyers as such. Dishd never computes either — a number we invented sitting
 * next to a real allergen list would be the most dangerous thing on the page.
 */
export async function addMenuItem(
  _prev: CookActionState,
  form: FormData,
): Promise<CookActionState> {
  const parsed = menuItemSchema.safeParse({
    name: form.get("name") ?? "",
    description: form.get("description") ?? "",
    price: form.get("price") ?? "",
    containsMeat: form.get("containsMeat") === "on",
    meatType: form.get("meatType") ?? "none",
    allergens: form.getAll("allergens").map(String),
    batchId: form.get("batchId") ?? "",
    calories: form.get("calories") ?? "",
    ingredients: form.get("ingredients") ?? "",
    portionSize: form.get("portionSize") ?? "",
    photoUrl: form.get("photoUrl") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the dish details.", errors: fieldErrors(parsed.error.issues) };
  }

  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "Create your kitchen first." };

  const v = parsed.data;
  if (v.containsMeat && !v.batchId) {
    return {
      ok: false,
      message: "A meat dish needs a sourcing batch behind it.",
      errors: { batchId: "Upload a receipt first, then attach it here." },
    };
  }

  // A dish photo, if one was attached. Uploaded as the cook so storage records
  // them as owner; a pasted link still works for anything already hosted.
  let photo = v.photoUrl;
  const upload = form.get("photoFile");
  if (upload instanceof File && upload.size > 0) {
    const problem = photoFileError(upload);
    if (problem) return { ok: false, message: problem, errors: { photoFile: problem } };
    const path = `dishes/${kitchen.id}/${crypto.randomUUID()}.${photoExtension(upload.type)}`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, upload, { contentType: upload.type, upsert: false });
    if (uploadError) {
      return {
        ok: false,
        message: "That photo could not be uploaded. Try again, or leave it out.",
        errors: { photoFile: uploadError.message },
      };
    }
    photo = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("menu_items").insert({
    kitchen_id: kitchen.id,
    name: v.name,
    description: v.description || null,
    price_cents: Math.round(v.price * 100),
    contains_meat: v.containsMeat,
    meat_type: v.containsMeat ? v.meatType : "none",
    sourcing_batch_id: v.containsMeat ? v.batchId : null,
    allergens: v.allergens.length > 0 ? v.allergens : ["none_declared"],
    is_available: true,
    calories: v.calories === "" ? null : Number(v.calories),
    ingredients: v.ingredients || null,
    portion_size: v.portionSize || null,
    photo_url: photo || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook/start");
  revalidatePath("/cook");
  revalidatePath("/cook/menu");
  revalidatePath(`/k/${kitchen.slug}`);
  return { ok: true, message: `${v.name} added to your menu.` };
}

/** Remove a dish. Past orders keep their own name and price snapshot. */
export async function deleteMenuItem(itemId: string): Promise<CookActionState> {
  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "No kitchen." };

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("kitchen_id", kitchen.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook/menu");
  revalidatePath("/cook");
  revalidatePath(`/k/${kitchen.slug}`);
  return { ok: true, message: "Dish removed." };
}

/** Close the kitchen, or reopen one the cook closed themselves. */
export async function setKitchenOpen(
  open: boolean,
  reason = "",
): Promise<CookActionState> {
  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "No kitchen." };

  const { error } = open
    ? await supabase.rpc("dishd_reopen_kitchen", { p_kitchen: kitchen.id })
    : await supabase.rpc("dishd_close_kitchen", { p_kitchen: kitchen.id, p_reason: reason });

  // The function raises readable messages ("Finish or decline your open
  // orders…"), so pass them through rather than replacing them.
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook");
  revalidatePath("/");
  revalidatePath(`/k/${kitchen.slug}`);
  return {
    ok: true,
    message: open ? "Your kitchen is open again." : "Your kitchen is closed.",
  };
}

/** Step 6 — open for orders. */
export async function goLive(): Promise<CookActionState> {
  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "Create your kitchen first." };

  // The gate is the same one a buyer sees: a permit claimed, and at least one
  // dish that can actually be sold.
  if (kitchen.permit_status === "none") {
    return { ok: false, message: "Claim your home kitchen permit before opening." };
  }

  const { count } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("kitchen_id", kitchen.id)
    .eq("is_available", true);
  if (!count) return { ok: false, message: "Add at least one dish before opening." };

  const { error } = await supabase
    .from("kitchens")
    .update({ status: "active" })
    .eq("id", kitchen.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook");
  revalidatePath("/");
  return { ok: true, message: "Your kitchen is open." };
}

/** Toggle a dish's availability from the dashboard. */
export async function setItemAvailability(itemId: string, available: boolean) {
  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { error: "No kitchen." };

  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: available })
    .eq("id", itemId)
    .eq("kitchen_id", kitchen.id);
  if (error) return { error: error.message };

  revalidatePath("/cook");
  return { ok: true };
}

type OwnedKitchen = { id: string; status: string; permit_status: string; slug: string };

async function ownedKitchen(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
): Promise<OwnedKitchen | null> {
  const { data } = await supabase
    .from("kitchens")
    .select("id, status, permit_status, slug")
    .eq("owner_id", userId)
    .maybeSingle();
  return (data as OwnedKitchen | null) ?? null;
}

/**
 * The terms this kitchen trades on: how long the food takes, whether it sells a
 * priority slot and for how much, and whether it takes bookings.
 *
 * Kept apart from onboarding because a cook changes these while trading — a
 * kitchen that is suddenly three hours deep says so by raising its cooking
 * time, and one that cannot keep up withdraws priority by pricing it at zero.
 */
export async function updateOrderSettings(
  _prev: CookActionState,
  form: FormData,
): Promise<CookActionState> {
  const { supabase, user } = await requireUser();
  const kitchen = await ownedKitchen(supabase, user.id);
  if (!kitchen) return { ok: false, message: "Create your kitchen first." };

  const errors: Record<string, string> = {};

  const prepMinutes = parsePrepMinutes(form.get("defaultPrepMinutes"));
  if (prepMinutes === null) {
    errors.defaultPrepMinutes = `Enter a whole number of minutes, ${PREP_MIN_MINUTES} to ${PREP_MAX_MINUTES}.`;
  }

  // Zero is a valid price and is how a kitchen withdraws the offer, so an empty
  // box is read as zero rather than rejected.
  const rawFee = String(form.get("priorityFee") ?? "").trim();
  const priorityFeeCents = rawFee === "" ? 0 : parsePriorityFeeCents(rawFee);
  if (priorityFeeCents === null) {
    errors.priorityFee = `Enter an amount between $0 and ${(MAX_PRIORITY_FEE_CENTS / 100).toFixed(2)}, or leave it empty to stop offering it.`;
  }

  if (Object.keys(errors).length) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  const { error } = await supabase
    .from("kitchens")
    .update({
      default_prep_minutes: prepMinutes,
      priority_fee_cents: priorityFeeCents,
      accepts_scheduled: form.get("acceptsScheduled") === "on",
    })
    .eq("id", kitchen.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/cook");
  revalidatePath(`/k/${kitchen.slug}`);
  return { ok: true, message: "Saved. New orders use these settings." };
}
