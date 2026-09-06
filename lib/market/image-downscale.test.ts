import { describe, expect, it } from "vitest";
import {
  REQUEST_SAFE_BYTES,
  downscaleImage,
  isDownscalable,
  requestTooLargeMessage,
  wouldExceedRequestLimit,
} from "./image-downscale";

const bytes = (n: number) => ({ size: n });

describe("what a canvas can re-encode", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "IMAGE/JPEG"])("accepts %s", (type) =>
    expect(isDownscalable(type)).toBe(true));

  // HEIC is what an iPhone produces by default and what most browsers refuse to
  // decode; a PDF receipt has no pixels to resample. Both must be left alone.
  it.each(["image/heic", "image/avif", "application/pdf", "", "text/plain"])(
    "refuses %s",
    (type) => expect(isDownscalable(type)).toBe(false),
  );
});

describe("the host's request limit", () => {
  it("sits below Vercel's 4.5 MB so the rest of the form still fits", () =>
    expect(REQUEST_SAFE_BYTES).toBeLessThan(4.5 * 1024 * 1024));

  it("allows a payload at the limit", () =>
    expect(wouldExceedRequestLimit([bytes(REQUEST_SAFE_BYTES)])).toBe(false));

  it("refuses one byte over", () =>
    expect(wouldExceedRequestLimit([bytes(REQUEST_SAFE_BYTES + 1)])).toBe(true));

  it("adds files up rather than checking them one at a time", () => {
    const third = Math.floor(REQUEST_SAFE_BYTES / 2);
    expect(wouldExceedRequestLimit([bytes(third)])).toBe(false);
    expect(wouldExceedRequestLimit([bytes(third), bytes(third), bytes(third)])).toBe(true);
  });

  it("treats an empty selection as sendable", () =>
    expect(wouldExceedRequestLimit([])).toBe(false));
});

describe("what the person is told", () => {
  it("names HEIC for a single file, which is the usual cause", () =>
    expect(requestTooLargeMessage(false)).toContain("HEIC"));

  it("tells them to choose fewer when there are several", () =>
    expect(requestTooLargeMessage(true)).toContain("fewer"));
});

describe("downscaling outside a browser", () => {
  const file = (type: string, size: number) =>
    new File([new Uint8Array(size)], "photo", { type });

  it("returns the original when there is no window, rather than throwing", async () => {
    // This runs server-side during SSR and in this suite; the guard is what
    // keeps the module importable from a component that renders on both sides.
    const original = file("image/jpeg", 1024 * 1024);
    expect(await downscaleImage(original)).toBe(original);
  });

  it("returns a format it cannot decode untouched", async () => {
    const heic = file("image/heic", 5 * 1024 * 1024);
    expect(await downscaleImage(heic)).toBe(heic);
  });

  it("leaves a small file alone, since re-encoding one can enlarge it", async () => {
    const small = file("image/jpeg", 20 * 1024);
    expect(await downscaleImage(small)).toBe(small);
  });
});
