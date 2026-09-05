import { z } from "zod";

const photoLink = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}, "Use an HTTPS photo link, or leave it blank.");

export const reviewSchema = z.object({
  rating: z.string().regex(/^(?:[0-9]|10)$/, "Choose a rating from 0 to 5 stars."),
  body: z.string().trim().max(3000, "Keep your review to 3,000 characters."),
  photo: photoLink,
  sourcing: z.enum(["yes", "no", "unsure"], { error: "Please answer the sourcing question; “Not sure” is fine." }),
});

export type ReviewActionState = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<"rating" | "body" | "photo" | "sourcing", string>>;
};

/**
 * Review photo uploads.
 *
 * A pasted HTTPS link was the only way to attach a photo, which nobody
 * finishing a pickup on their phone can actually do. These rules gate the file
 * itself; the bucket in migration 0007 enforces the same size and types, so a
 * direct storage call cannot go around them.
 */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

/** The accept attribute for the file input, kept in step with PHOTO_TYPES. */
export const PHOTO_ACCEPT = Object.keys(PHOTO_TYPES).join(",");

/** Extension to store the upload under, or null if the type is not allowed. */
export function photoExtension(mimeType: string): string | null {
  return PHOTO_TYPES[mimeType.toLowerCase()] ?? null;
}

/** Null when the file is acceptable, otherwise why it is not. */
export function photoFileError(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "That file looks empty. Try choosing it again.";
  if (file.size > PHOTO_MAX_BYTES) {
    return `Photos need to be under ${Math.floor(PHOTO_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  if (!photoExtension(file.type)) return "Choose a JPEG, PNG, WebP, AVIF or HEIC image.";
  return null;
}
