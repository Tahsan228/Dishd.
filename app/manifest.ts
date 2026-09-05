import type { MetadataRoute } from "next";

/**
 * The web app manifest.
 *
 * app/layout.tsx has always declared `manifest: "/manifest.webmanifest"` and an
 * apple-touch-icon, but neither file existed — both 404'd. So the README's
 * "mobile-first PWA" could not be installed to a home screen on any device, and
 * the whole point of the product is that it is used one-handed on a phone at a
 * cook's door.
 *
 * This is the file convention rather than a static public/manifest.webmanifest
 * so the shape is type-checked and the theme colour cannot drift from the
 * palette.
 *
 * The single 1080x1080 icon is the real asset at its real size, not a resized
 * copy declared as several. Chrome's install criteria ask for an icon at least
 * 192px and one at least 512px; one 1080px icon satisfies both, and browsers
 * downscale it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dishd — halal home kitchens near you",
    short_name: "Dishd",
    description:
      "Halal home kitchens near you. Receipt-verified sourcing, real credibility, pickup from the cook's door.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the `forest` token in globals.css and the viewport themeColor.
    background_color: "#FEF8F6",
    theme_color: "#00372C",
    categories: ["food", "shopping", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-1080.png",
        sizes: "1080x1080",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
