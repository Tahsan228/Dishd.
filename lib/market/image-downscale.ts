/**
 * Shrink photos in the browser before they are posted to a server action.
 *
 * This exists because of a hosting limit, not a product one. A Vercel function
 * rejects any request body over 4.5 MB at the edge, before our code runs, so an
 * 8 MB phone photo would fail with a bare 413 and no message a person could act
 * on — while working perfectly in local development, where no such limit
 * applies. The upload validators still allow 8 MB per file, because the storage
 * bucket does; what changes is that a file that large now arrives re-encoded to
 * a fraction of it.
 *
 * A receipt is evidence a reviewer has to read, so the long edge is generous
 * and the quality high. The point is to remove megapixels a phone camera adds
 * and nobody needs, not to compress until the text goes.
 *
 * Anything that cannot be decoded by a canvas — HEIC, which most browsers will
 * not decode, and PDF — is returned untouched. `wouldExceedRequestLimit` is how
 * the caller then refuses it with a sentence instead of a 413.
 */

/** Vercel's hard limit is 4.5 MB; this leaves room for the rest of the form. */
export const REQUEST_SAFE_BYTES = 4 * 1024 * 1024;

/** Long edge, in pixels. A receipt stays readable well below this. */
export const DOWNSCALE_MAX_EDGE = 2000;

const DOWNSCALE_QUALITY = 0.85;

/** Below this a file is left alone: re-encoding a small image can enlarge it. */
const DOWNSCALE_FLOOR_BYTES = 600 * 1024;

/** Formats a browser canvas can reliably decode and re-encode. */
const DECODABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isDownscalable(type: string): boolean {
  return DECODABLE.has(type.toLowerCase());
}

/** True when these files together would be refused by the host. */
export function wouldExceedRequestLimit(files: { size: number }[]): boolean {
  return files.reduce((total, file) => total + file.size, 0) > REQUEST_SAFE_BYTES;
}

/**
 * Re-encode one image smaller. Returns the original on any failure — a photo
 * that will not downscale is still worth attempting to upload, and the size
 * check afterwards is what decides whether it can go.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!isDownscalable(file.type) || file.size <= DOWNSCALE_FLOOR_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, DOWNSCALE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // PNG is kept as PNG: a receipt screenshot re-encoded to JPEG picks up
    // artefacts exactly where the small text is.
    const type = file.type.toLowerCase() === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, DOWNSCALE_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".jpg");
    return new File([blob], name, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Downscale a set of files, keeping their order. */
export async function downscaleAll(files: File[]): Promise<File[]> {
  return Promise.all(files.map(downscaleImage));
}

/**
 * The message for a payload the host will refuse. Named for what the person
 * has to do about it rather than for the limit they cannot see.
 */
export function requestTooLargeMessage(plural: boolean): string {
  return plural
    ? "Those photos are still too large to send together. Choose fewer, or smaller ones."
    : "That file is too large to send. If it is a HEIC photo, try saving it as JPEG first.";
}
