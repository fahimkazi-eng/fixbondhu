import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali, Space_Grotesk } from "next/font/google";

import "./globals.css";

import { DemoBanner } from "@/components/demo-banner";

/*
 * All three faces are self-hosted by next/font, so there is no third-party
 * request on first paint. That matters twice over in Bangladesh: it removes a
 * round trip to Google's servers, and it removes a third-party dependency from a
 * product used by small tradespeople.
 *
 * The variable name is deliberately NOT "--font-bangla". That name is used by
 * the Tailwind theme token in globals.css, and declaring both produced a
 * self-referential var() that resolved to nothing, silently preventing the
 * Bangla face from ever loading.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-bangla",
  display: "swap",
});

/*
 * Space Grotesk for display type only. Its letterforms have squared terminals
 * and a tall x-height, which is what lets a 76px heading look engineered
 * rather than blown up — Inter at the same size reads as a paragraph that
 * someone made bigger.
 *
 * Loaded at weights 500-700 only. Below 500 it is never used for display, and
 * shipping the full weight axis would add four font files for no rendered text.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FixBondhu — verified local services, booked in minutes",
    template: "%s | FixBondhu",
  },
  description:
    "Find and book verified electricians, plumbers, AC technicians and repair professionals near you in Bangladesh. Transparent prices, real reviews, secure payment.",
  applicationName: "FixBondhu",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FixBondhu", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "FixBondhu",
    locale: "en_BD",
  },
};

export const viewport: Viewport = {
  // Matches --color-ink-50. The previous value was the old brand teal, which
  // produced a bright teal band above a near-black page in mobile Chrome and
  // Safari — the one place the OS chrome is guaranteed to be seen.
  themeColor: "#08080b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Not capped: pinch-zoom must work, and blocking it is an accessibility
  // failure that matters for older users reading small Bangla text.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bangla.variable} ${display.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-400 focus:px-4 focus:py-2 focus:text-sm focus:text-ink-50"
        >
          Skip to content
        </a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
