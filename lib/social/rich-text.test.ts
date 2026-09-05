import { describe, expect, it } from "vitest";
import { reviewText } from "./rich-text";
describe("review links and mentions", () => {
  it("links a neighbor and a kitchen without parsing HTML", () => {
    expect(reviewText("Thanks @yusuf at [Amina’s](/k/aminas-kitchen)")).toEqual([{ text: "Thanks " }, { text: "@yusuf", href: "/u/yusuf" }, { text: " at " }, { text: "Amina’s", href: "/k/aminas-kitchen" }]);
  });
  it("does not turn email addresses into mentions", () => expect(reviewText("hi@example.com").some(p => p.href)).toBe(false));
  it("leaves scripts, credentials, and arbitrary markdown as text", () => {
    for (const value of ["[x](javascript:alert(1))", "<script>alert(1)</script>", "https://user:pass@example.com"]) expect(reviewText(value).some(p => p.href)).toBe(false);
  });
  it("keeps trailing punctuation outside external links", () => {
    expect(reviewText("See https://example.com.")).toEqual([{ text: "See " }, { text: "https://example.com", href: "https://example.com/", external: true }, { text: "." }]);
  });
});
