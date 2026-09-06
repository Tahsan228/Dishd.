import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Files are capped at 8 MB individually and 12 MB in total by the upload validators.
  // Leave room for multipart overhead; Next's 1 MB default rejected phone photos.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  // Lets a production build run beside the shared dev preview on port 4173
  // without the two fighting over .next.
  //
  // Explicitly ignored on Vercel. A host that expects its output in .next and
  // does not find it serves a bare platform 404 with nothing in the build log
  // to explain it, so this convenience must not be able to reach production
  // even if the variable is set there by accident.
  //
  // Building with it set makes Next rewrite tsconfig.json and next-env.d.ts to
  // point at the alternate types directory. That is local scaffolding for a
  // directory no other checkout has: revert it rather than committing it.
  ...(process.env.NEXT_DIST_DIR && !process.env.VERCEL
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
};

export default nextConfig;
