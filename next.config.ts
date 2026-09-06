import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Files are capped at 8 MB individually and 12 MB in total by the upload validators.
  // Leave room for multipart overhead; Next's 1 MB default rejected phone photos.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  // Lets a production build run beside the shared dev preview on port 4173
  // without the two fighting over .next. Unset everywhere else, including on
  // Vercel, so the default output directory is used there.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
