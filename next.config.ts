import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config = (phase: string): NextConfig => ({
  poweredByHeader: false,
  devIndicators: false,
  // Production checks must not replace the user's running development preview.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-build",
});
export default config;
