import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";

import "./globals.css";

import { DemoBanner } from "@/components/demo-banner";

/*
 * Both fonts are self-hosted by next/font, so there is no third-party request
 * on first paint. That matters twice over in Bangladesh: it removes a round
 * trip to Google's servers, and it removes a third-party dependency from a
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
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Not capped: pinch-zoom must work, and blocking it is an accessibility
  // failure that matters for older users reading small Bangla text.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${bangla.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
