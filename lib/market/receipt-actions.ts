"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import type { MeatType } from "@/lib/types";
import { receiptFileError, RECEIPT_TYPES } from "@/lib/market/upload-validation";
import {
  runLocalChecks,
  allPassed,
  failureReasons,
  backsItemsUntil,
  normaliseStore,
  type CheckResult,
  type ReceiptDeclaration,
} from "@/lib/market/receipts";

export type SubmitReceiptResult = {
  ok: boolean;
  status: "pending" | "mismatch";
  checks: CheckResult[];
  message: string;
  batchId?: string;
};

/**
 * Submit a sourcing receipt.
 *
 * Deterministic checks run first and are free. If any fails the batch is
 * recorded as a mismatch immediately and the cook is told exactly why — no
 * review queue, no waiting. If they all pass the batch goes to 'pending' and a
 * human confirms the uploaded image matches what was declared.
 *
 * The batch row is written either way. A rejected receipt is evidence too:
 * it is what breaks a kitchen's trust streak.
 */
export async function submitReceipt(
  kitchenId: string,
  form: FormData,
): Promise<SubmitReceiptResult> {
  try { return await submitReceiptChecked(kitchenId, form); }
  catch {
    return { ok: false, status: "mismatch", checks: [], message: "Receipt submissions are temporarily unavailable. Your declaration is still here; please try again shortly." };
  }
}

async function submitReceiptChecked(kitchenId: string, form: FormData): Promise<SubmitReceiptResult> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: "mismatch", checks: [], message: "You must be signed in." };
  }

  // Ownership. RLS would block the insert anyway, but fail with a clear message.
  const { data: kitchen } = await supabase
    .from("kitchens")
    .select("id, owner_id")
    .eq("id", kitchenId)
    .maybeSingle();

  if (!kitchen || kitchen.owner_id !== user.id) {
    return {
      ok: false,
      status: "mismatch",
      checks: [],
      message: "That isn't your kitchen.",
    };
  }

  const candidate = form.get("receipt");
  const file = candidate instanceof File ? candidate : null;
  const fileProblem = receiptFileError(file);
  if (fileProblem || !file) return { ok: false, status: "mismatch", checks: [], message: fileProblem ?? "Attach a receipt." };
  const declaration: ReceiptDeclaration = {
    halalSourceId: (form.get("halalSourceId") as string) || null,
    storeName: ((form.get("storeName") as string) ?? "").trim(),
    purchaseDate: (form.get("purchaseDate") as string) ?? "",
    totalCents: Math.round(Number(form.get("totalDollars") ?? 0) * 100),
    meatTypes: form.getAll("meatTypes") as MeatType[],
  };

  if (!file || file.size === 0) {
    return {
      ok: false,
      status: "mismatch",
      checks: [],
      message: "Attach a photo of the receipt.",
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { data: sources, error: sourcesError } = await supabase
    .from("halal_sources")
    .select("id, store_name")
    .eq("kitchen_id", kitchenId);

  if (sourcesError) return { ok: false, status: "mismatch", checks: [], message: "Your registered suppliers could not be loaded. Please try again." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(declaration.purchaseDate) || !Number.isSafeInteger(declaration.totalCents) || declaration.totalCents <= 0) return { ok: false, status: "mismatch", checks: [], message: "Enter a valid purchase date and receipt total." };
  const checks = runLocalChecks(declaration, sources ?? [], new Date());

  // Duplicate detection needs to see across every kitchen, including ones this
  // cook cannot read — that is the whole point, so it runs as the service role.
  const admin = createServiceClient();

  const { data: sameImage, error: imageCheckError } = await admin
    .from("sourcing_batches")
    .select("id, kitchen_id")
    .eq("image_sha256", sha256)
    .maybeSingle();

  if (imageCheckError) return { ok: false, status: "mismatch", checks, message: "Duplicate checking is temporarily unavailable. No receipt was submitted." };
  checks.push({
    code: "not_duplicate_image",
    label: "Receipt image not used before",
    passed: !sameImage,
    detail: sameImage
      ? sameImage.kitchen_id === kitchenId
        ? "You have already submitted this exact photo"
        : "This exact photo has already been submitted by another kitchen"
      : "First submission of this image",
  });

  const { data: sameReceipt, error: receiptCheckError } = await admin
    .from("sourcing_batches")
    .select("id, kitchen_id, ocr_store")
    .eq("ocr_date", declaration.purchaseDate)
    .eq("ocr_total_cents", declaration.totalCents)
    .limit(20);

  if (receiptCheckError) return { ok: false, status: "mismatch", checks, message: "Duplicate checking is temporarily unavailable. No receipt was submitted." };
  const collision = (sameReceipt ?? []).find(
    (b) => normaliseStore(b.ocr_store ?? "") === normaliseStore(declaration.storeName),
  );

  checks.push({
    code: "not_duplicate_receipt",
    label: "Receipt not claimed elsewhere",
    passed: !collision,
    detail: collision
      ? "A receipt with this store, date and total is already on file"
      : "No matching receipt on file",
  });

  const passed = allPassed(checks);
  const reasons = failureReasons(checks);

  // Upload the image regardless: a rejected receipt is still evidence.
  const path = `${kitchenId}/${sha256.slice(0, 16)}-${Date.now()}.${
    RECEIPT_TYPES[file.type.toLowerCase() as keyof typeof RECEIPT_TYPES]
  }`;

  const { error: uploadError } = await admin.storage
    .from("receipts")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      ok: false,
      status: "mismatch",
      checks,
      message: `Could not store the receipt image: ${uploadError.message}`,
    };
  }

  const { data: batch, error: insertError } = await supabase
    .from("sourcing_batches")
    .insert({
      kitchen_id: kitchenId,
      halal_source_id: declaration.halalSourceId,
      receipt_path: path,
      image_sha256: sha256,
      purchased_on: declaration.purchaseDate || null,
      ocr_store: declaration.storeName,
      ocr_total_cents: declaration.totalCents,
      ocr_date: declaration.purchaseDate || null,
      declared_meat_types: declaration.meatTypes,
      match_status: passed ? "pending" : "mismatch",
      mismatch_reasons: reasons,
      backs_items_until: declaration.purchaseDate
        ? backsItemsUntil(declaration.purchaseDate)
        : null,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from("receipts").remove([path]);
    // The unique indexes are the backstop if two submissions race each other.
    const duplicate = insertError.code === "23505";
    return {
      ok: false,
      status: "mismatch",
      checks,
      message: duplicate
        ? "This receipt has already been submitted."
        : `Could not save the receipt: ${insertError.message}`,
    };
  }

  revalidatePath("/cook");
  revalidatePath("/cook/start");

  return {
    ok: passed,
    status: passed ? "pending" : "mismatch",
    checks,
    batchId: batch?.id,
    message: passed
      ? "Receipt received and awaiting human review. Your sourcing badge will update when a reviewer confirms it."
      : "This receipt was rejected. Fix the issues below and submit again.",
  };
}
