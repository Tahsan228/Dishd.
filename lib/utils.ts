import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is always integer cents. Renders as $12.50. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Ratings are stored 0-10 and shown as 0-5 stars. */
export function toStars(rating10: number): number {
  return Math.round((rating10 / 2) * 10) / 10;
}
