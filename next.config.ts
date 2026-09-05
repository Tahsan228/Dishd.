import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Files are capped at 8 MB individually and 12 MB in total by the upload validators.
  // Leave room for multipart overhead; Next's 1 MB default rejected phone photos.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};

export default nextConfig;
