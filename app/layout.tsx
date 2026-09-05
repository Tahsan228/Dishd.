import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Instrument Serif matches the wordmark's high-contrast editorial cut far more
// closely than a variable workhorse serif does, and Instrument Sans is its
// designed companion — so the pairing reads as one voice rather than two fonts
// picked independently.
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
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
