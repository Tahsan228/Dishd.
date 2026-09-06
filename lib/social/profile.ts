import { z } from "zod";

/**
 * Diary customisation.
 *
 * Kept in a plain module so both the client form and the server action can
 * import it — a `"use server"` file may only export async functions.
 */

/**
 * Accents are a fixed list of palette tokens, not a colour picker.
 *
 * A free colour would let anyone put unreadable text on the cream ground and
 * would quietly become a second brand. Each of these already means something in
 * the design system, so a diary can feel personal without the identity drifting.
 */
export const ACCENTS = [
  { key: "forest", label: "Forest", swatch: "bg-forest", ring: "ring-forest" },
  { key: "brass", label: "Brass", swatch: "bg-brass", ring: "ring-brass" },
  { key: "clay", label: "Clay", swatch: "bg-clay", ring: "ring-clay" },
  { key: "amber", label: "Amber", swatch: "bg-amber", ring: "ring-amber" },
] as const;

export type Accent = (typeof ACCENTS)[number]["key"];

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && ACCENTS.some((a) => a.key === value);
}

/** Header classes for an accent, so the banner and page agree. */
export function accentClasses(accent: string): { band: string; chip: string } {
  switch (accent) {
    case "brass":
      return { band: "bg-brass", chip: "bg-brass/15 text-brass-ink" };
    case "clay":
      return { band: "bg-clay", chip: "bg-clay/15 text-clay" };
    case "amber":
      return { band: "bg-amber", chip: "bg-amber/15 text-amber" };
    case "forest":
    default:
      return { band: "bg-forest", chip: "bg-forest-soft text-forest" };
  }
}

const httpsImage = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .default("")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a public https:// image link, or upload a picture instead.");

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Tell people what to call you.")
    .max(60, "Keep your name under 60 characters."),
  tagline: z.string().trim().max(80, "Keep the tagline under 80 characters.").optional().default(""),
  bio: z.string().trim().max(600, "Keep your bio under 600 characters.").optional().default(""),
  city: z.string().trim().max(80, "Keep the city short.").optional().default(""),
  accent: z.string().refine(isAccent, "Choose one of the available accents."),
  avatarUrl: httpsImage,
  bannerUrl: httpsImage,
});

export type ProfileFormState = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<
    "displayName" | "tagline" | "bio" | "city" | "accent" | "avatarUrl" | "bannerUrl" | "avatarFile" | "bannerFile",
    string
  >>;
};

export type FollowCounts = { followers: number; following: number };
