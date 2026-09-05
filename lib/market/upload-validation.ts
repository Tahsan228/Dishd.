export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_TOTAL_BYTES = 12 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/heic": "heic" };
export const RECEIPT_TYPES = { ...IMAGE_TYPES, "application/pdf": "pdf" };
export const RECEIPT_ACCEPT = Object.keys(RECEIPT_TYPES).join(",");
export function receiptFileError(file: { size: number; type: string } | null): string | null {
  if (!file || file.size <= 0) return "Attach a receipt image or PDF.";
  if (file.size > UPLOAD_MAX_BYTES) return "That receipt is too large. Choose a file up to 8 MB.";
  if (!Object.hasOwn(RECEIPT_TYPES, file.type.toLowerCase())) return "Choose a JPEG, PNG, WebP, AVIF, HEIC image, or a PDF.";
  return null;
}
export function galleryError(files: { size: number; type: string }[]): string | null {
  if (files.length > 3) return "Choose up to three photos.";
  if (files.some(file => file.size <= 0 || file.size > UPLOAD_MAX_BYTES || !Object.hasOwn(IMAGE_TYPES, file.type.toLowerCase()))) return "Each photo must be a supported image up to 8 MB.";
  if (files.reduce((sum, file) => sum + file.size, 0) > UPLOAD_TOTAL_BYTES) return "The photos together must be no larger than 12 MB.";
  return null;
}
