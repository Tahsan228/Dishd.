import { z } from "zod";

/**
 * Sign-up rules, shared by the form and the server action.
 *
 * The handle shape here is the same one migration 0006 pins as a CHECK
 * constraint and normalises in dishd_normalise_handle(). Keep the three in
 * step: a handle is a public URL (/u/<handle>), so it cannot be repaired later
 * without breaking links.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const PASSWORD_MIN = 8;

const HANDLE_SHAPE = /^[a-z0-9_]{3,20}$/;

/** Reserved because a profile lives at /u/<handle> and these are real routes. */
const RESERVED_HANDLES = new Set([
  "admin", "api", "auth", "cook", "dishd", "diary", "help", "k", "legal",
  "log", "login", "logout", "new", "order", "orders", "privacy", "record",
  "reviews", "root", "settings", "signin", "signup", "support", "terms", "u",
]);

/**
 * Turn anything a human types into a legal handle, or null if nothing usable
 * survives. Mirrors dishd_normalise_handle() in 0006.
 */
export function normaliseHandle(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX);
  return cleaned.length >= HANDLE_MIN ? cleaned : null;
}

export function handleError(raw: string): string | null {
  const normalised = normaliseHandle(raw);
  if (!normalised) return `Handles are ${HANDLE_MIN}–${HANDLE_MAX} letters, numbers or underscores.`;
  if (!HANDLE_SHAPE.test(normalised)) return "Use only letters, numbers and underscores.";
  if (RESERVED_HANDLES.has(normalised)) return "That handle is reserved. Try another.";
  return null;
}

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(72, "Passwords are limited to 72 characters."),
  displayName: z
    .string()
    .trim()
    .min(2, "Tell us what to call you.")
    .max(60, "Keep your name under 60 characters."),
  handle: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const problem = handleError(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
  city: z.string().trim().max(80, "Keep the city short.").optional().default(""),
});

export type SignUpFields = "email" | "password" | "displayName" | "handle" | "city";

export type SignUpState = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<SignUpFields, string>>;
};
