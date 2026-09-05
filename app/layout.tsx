import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "../public/fonts/fraunces.woff2",
  variable: "--font-display-face",
  display: "swap",
});

const sans = localFont({
  src: "../public/fonts/dm-sans.woff2",
  variable: "--font-sans-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dishd",
  description:
    "Halal home kitchens near you. Receipt-verified sourcing, real credibility, pickup from the cook's door.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Dishd" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#00372C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
