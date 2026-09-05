import { describe, expect, it } from "vitest";
import { handleError, normaliseHandle, signUpSchema } from "./account";

describe("normaliseHandle", () => {
  it("lowercases and keeps legal characters", () => {
    expect(normaliseHandle("Yusuf")).toBe("yusuf");
    expect(normaliseHandle("amina_99")).toBe("amina_99");
  });

  it("collapses anything illegal into single underscores", () => {
    expect(normaliseHandle("Amina  Yusuf")).toBe("amina_yusuf");
    expect(normaliseHandle("chef!!!bilal")).toBe("chef_bilal");
    expect(normaliseHandle("  _layla_  ")).toBe("layla");
  });

  it("truncates to the 20-character budget the database enforces", () => {
    const long = normaliseHandle("a".repeat(40));
    expect(long).toHaveLength(20);
  });

  it("returns null when nothing usable survives", () => {
    expect(normaliseHandle("!!")).toBeNull();
    expect(normaliseHandle("  ")).toBeNull();
    expect(normaliseHandle("ab")).toBeNull();
  });
});

describe("handleError", () => {
  it("accepts a plain handle", () => {
    expect(handleError("yusuf")).toBeNull();
    expect(handleError("cook_2026")).toBeNull();
  });

  it("rejects handles that collide with real routes", () => {
    // A profile lives at /u/<handle>, and these are pages in their own right.
    for (const reserved of ["admin", "signin", "signup", "cook", "record", "legal"]) {
      expect(handleError(reserved)).toBe("That handle is reserved. Try another.");
    }
  });

  it("rejects anything too short to normalise", () => {
    expect(handleError("ab")).toMatch(/3–20/);
  });
});

describe("signUpSchema", () => {
  const valid = {
    email: "New.Cook@example.com",
    password: "a-good-password",
    displayName: "New Cook",
    handle: "new_cook",
    city: "Fremont, CA",
  };

  it("accepts a complete sign-up and lowercases the email", () => {
    const parsed = signUpSchema.parse(valid);
    expect(parsed.email).toBe("new.cook@example.com");
    expect(parsed.handle).toBe("new_cook");
  });

  it("requires a password long enough to be worth having", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a reserved handle", () => {
    expect(signUpSchema.safeParse({ ...valid, handle: "admin" }).success).toBe(false);
  });

  it("treats city as optional", () => {
    const parsed = signUpSchema.parse({ ...valid, city: undefined });
    expect(parsed.city).toBe("");
  });
});
