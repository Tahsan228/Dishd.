import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl } from "./stripe";

/**
 * Where Stripe sends a buyer back to.
 *
 * Worth testing because getting it wrong is invisible until a real person has
 * paid: the charge succeeds and the redirect lands on a host that does not
 * exist. The old behaviour was to fall through to localhost whenever
 * NEXT_PUBLIC_APP_URL was unset, which is exactly what a fresh Vercel project
 * looks like.
 */
afterEach(() => vi.unstubAllEnvs());

const clearHost = () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
};

describe("the base URL Stripe returns to", () => {
  it("uses an explicit setting above everything else", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dishd.example");
    vi.stubEnv("VERCEL_URL", "ignored.vercel.app");
    expect(appUrl()).toBe("https://dishd.example");
  });

  it("drops a trailing slash, which Stripe would otherwise double", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dishd.example/");
    expect(appUrl()).toBe("https://dishd.example");
  });

  it("ignores an empty or whitespace setting instead of returning nothing", () => {
    clearHost();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "   ");
    vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
    expect(appUrl()).toBe("https://deployment.vercel.app");
  });

  it("uses the stable production domain on a production deployment", () => {
    clearHost();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "dishd.vercel.app");
    vi.stubEnv("VERCEL_URL", "dishd-abc123.vercel.app");
    expect(appUrl()).toBe("https://dishd.vercel.app");
  });

  it("sends a preview deployment back to itself, not to production", () => {
    clearHost();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "dishd.vercel.app");
    vi.stubEnv("VERCEL_URL", "dishd-pr-7.vercel.app");
    expect(appUrl()).toBe("https://dishd-pr-7.vercel.app");
  });

  it("adds the scheme Vercel omits", () => {
    clearHost();
    vi.stubEnv("VERCEL_URL", "dishd-abc123.vercel.app");
    expect(appUrl()).toBe("https://dishd-abc123.vercel.app");
  });

  it("does not double the scheme if one is already there", () => {
    clearHost();
    vi.stubEnv("VERCEL_URL", "https://dishd-abc123.vercel.app");
    expect(appUrl()).toBe("https://dishd-abc123.vercel.app");
  });

  it("falls back to localhost only when nothing else is set", () => {
    clearHost();
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
