import { describe, expect, it } from "vitest";
import { reviewSchema } from "./review-validation";

const draft = { rating: "9", body: "A lovely meal.", photo: "", sourcing: "yes" };

describe("review form validation", () => {
  it.each(["0", "1", "9", "10"])("accepts stored rating %s", (rating) => {
    expect(reviewSchema.safeParse({ ...draft, rating }).success).toBe(true);
  });
  it.each(["", "-1", "11", "4.5", "NaN"])("rejects invalid rating %s", (rating) => {
    expect(reviewSchema.safeParse({ ...draft, rating }).success).toBe(false);
  });
  it.each(["yes", "no", "unsure"])("accepts sourcing answer %s", (sourcing) => {
    expect(reviewSchema.safeParse({ ...draft, sourcing }).success).toBe(true);
  });
  it("requires an explicit sourcing answer", () => {
    expect(reviewSchema.safeParse({ ...draft, sourcing: null }).success).toBe(false);
  });
  it("allows optional body/photo and trims whitespace", () => {
    expect(reviewSchema.parse({ ...draft, body: "  ", photo: "  " })).toMatchObject({ body: "", photo: "" });
  });
  it("caps review length", () => {
    expect(reviewSchema.safeParse({ ...draft, body: "a".repeat(3000) }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...draft, body: "a".repeat(3001) }).success).toBe(false);
  });
  it("accepts HTTPS image links", () => {
    expect(reviewSchema.safeParse({ ...draft, photo: "https://images.example/meal.jpg" }).success).toBe(true);
  });
  it.each(["http://images.example/meal.jpg", "javascript:alert(1)", "data:image/svg+xml,x", "https://user:password@example.com/a.jpg", "not a url"])("rejects unsafe photo input %s", (photo) => {
    expect(reviewSchema.safeParse({ ...draft, photo }).success).toBe(false);
  });
  it("discards attempted writes to verification and author fields", () => {
    expect(reviewSchema.parse({ ...draft, is_verified: true, buyer_id: "someone-else", order_id: "another-order" })).toEqual(draft);
  });
});
