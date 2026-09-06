import { z } from "zod";
import { JURISDICTIONS } from "./jurisdictions";

/**
 * Validation for cook onboarding, kept out of the "use server" module so both
 * the form and the action can import it — a server-action file may only export
 * async functions.
 */

export type CookActionState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
};

export const MEAT_TYPES = ["beef", "lamb", "chicken", "goat", "other"] as const;

export const ALLERGENS = [
  "gluten",
  "dairy",
  "tree_nuts",
  "peanuts",
  "sesame",
  "mustard",
  "egg",
  "soy",
  "fish",
  "shellfish",
] as const;

/**
 * Where Dishd has a home-cooking framework it understands.
 *
 * Derived from JURISDICTIONS so the county list and the permit named on screen
 * can never drift apart — offering a county whose permit we cannot name would
 * send a cook looking for the wrong licence.
 */
export const COUNTIES: { county: string; stateCode: string }[] = JURISDICTIONS.map(
  ({ county, stateCode }) => ({ county, stateCode }),
);

export const kitchenSchema = z.object({
  name: z.string().trim().min(2, "Give your kitchen a name.").max(80, "Keep the name under 80 characters."),
  bio: z.string().trim().max(600, "Keep it under 600 characters.").optional().default(""),
  cuisineTags: z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6),
    ),
  line1: z.string().trim().min(3, "Enter your street address.").max(120),
  line2: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().min(2, "Enter your city.").max(60),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP."),
  county: z.string().trim().min(2, "Choose your county."),
  stateCode: z.string().trim().length(2, "Two-letter state code."),
});

export const permitSchema = z.object({
  permitNo: z
    .string()
    .trim()
    .min(4, "Enter the permit number from your county.")
    .max(40, "That looks too long for a permit number."),
});

export const addSourceSchema = z.object({
  storeName: z.string().trim().min(2, "Enter the shop's name.").max(80),
  storeAddress: z.string().trim().max(160).optional().default(""),
  certBody: z.string().trim().max(60).optional().default(""),
});

/** Portion sizes a home cook actually thinks in. */
export const PORTION_SIZES = [
  "Individual portion",
  "Generous single",
  "Shares between two",
  "Family tray (3–4)",
  "Party tray (6+)",
] as const;

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, "Name the dish.").max(80),
  description: z.string().trim().max(400, "Keep it under 400 characters.").optional().default(""),
  price: z.coerce
    .number({ error: "Enter a price." })
    .positive("A dish has to cost something.")
    .max(500, "That seems too high for one dish."),
  containsMeat: z.boolean(),
  meatType: z.enum(["beef", "lamb", "chicken", "goat", "other", "none"]),
  allergens: z.array(z.string()).max(12),
  batchId: z.string().trim().optional().default(""),
  /**
   * Cook-declared, per portion. Blank means "not stated", which is honest —
   * a home cook guessing a number is worse than saying nothing, and the menu
   * renders the absence rather than a zero.
   */
  calories: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (v) => v === "" || (/^\d{1,4}$/.test(v) && Number(v) <= 5000),
      "Enter calories as a whole number up to 5000, or leave it blank.",
    ),
  /** Free text in the cook's own words. Allergens stay a structured field. */
  ingredients: z
    .string()
    .trim()
    .max(600, "Keep the ingredient list under 600 characters.")
    .optional()
    .default(""),
  portionSize: z.string().trim().max(40).optional().default(""),
  photoUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .default("")
    .refine((v) => {
      if (!v) return true;
      try {
        const url = new URL(v);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Use a public https:// image link, or upload a photo instead."),
});

/**
 * The six steps, in the order the rules require them.
 *
 * Sequence is not decoration: a meat dish cannot exist without a receipt behind
 * it (the database refuses), and a kitchen should not take orders before it has
 * claimed a permit.
 */
export const ONBOARDING_STEPS = [
  { key: "kitchen", title: "Your kitchen", blurb: "Name, cuisine, and the address you cook from." },
  { key: "permit", title: "Home kitchen permit", blurb: "The permit your county requires to cook and sell from home." },
  { key: "sources", title: "Halal suppliers", blurb: "Where you buy meat. Receipts are matched to these." },
  { key: "receipt", title: "Sourcing receipt", blurb: "Proof of purchase for the meat you cook with." },
  { key: "menu", title: "Your menu", blurb: "The dishes you sell, and what is in them." },
  { key: "live", title: "Open for orders", blurb: "Publish your kitchen." },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export type OnboardingProgress = {
  hasKitchen: boolean;
  hasPermit: boolean;
  hasSource: boolean;
  hasBatch: boolean;
  hasMenuItem: boolean;
  isLive: boolean;
};

/** The first step still outstanding, which is the one to show. */
export function currentStep(p: OnboardingProgress): OnboardingStepKey {
  if (!p.hasKitchen) return "kitchen";
  if (!p.hasPermit) return "permit";
  if (!p.hasSource) return "sources";
  if (!p.hasBatch) return "receipt";
  if (!p.hasMenuItem) return "menu";
  return "live";
}

export function stepIsDone(p: OnboardingProgress, key: OnboardingStepKey): boolean {
  switch (key) {
    case "kitchen": return p.hasKitchen;
    case "permit": return p.hasPermit;
    case "sources": return p.hasSource;
    case "receipt": return p.hasBatch;
    case "menu": return p.hasMenuItem;
    case "live": return p.isLive;
  }
}

export function completedCount(p: OnboardingProgress): number {
  return ONBOARDING_STEPS.filter((s) => stepIsDone(p, s.key)).length;
}
