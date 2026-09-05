import { describe, expect, it } from "vitest";
import { receiptFileError, galleryError, UPLOAD_MAX_BYTES } from "./upload-validation";
describe("phone photo transport limits", () => {
  it("accepts a typical receipt above Next's former 1 MB cap", () => expect(receiptFileError({ size: 3 * 1024 * 1024, type: "image/jpeg" })).toBeNull());
  it("accepts a PDF but rejects scriptable images and missing files", () => {
    expect(receiptFileError({ size: 100, type: "application/pdf" })).toBeNull();
    expect(receiptFileError({ size: 100, type: "image/svg+xml" })).toBeTruthy();
    expect(receiptFileError(null)).toBeTruthy();
  });
  it("caps single files and combined multipart galleries", () => {
    expect(receiptFileError({ size: UPLOAD_MAX_BYTES + 1, type: "image/jpeg" })).toBeTruthy();
    expect(galleryError(Array.from({ length: 3 }, () => ({ size: 4 * 1024 * 1024, type: "image/jpeg" })))).toBeNull();
    expect(galleryError(Array.from({ length: 3 }, () => ({ size: 5 * 1024 * 1024, type: "image/jpeg" })))).toBeTruthy();
    expect(galleryError(Array.from({ length: 4 }, () => ({ size: 100, type: "image/jpeg" })))).toBeTruthy();
  });
});
