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
