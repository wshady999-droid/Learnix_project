import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { PreferencesScript } from "@/components/theme/preferences-script";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Learnix | AI-Powered Educational Platform",
    template: "%s | Learnix",
  },
  description:
    "Learnix is a modern educational platform uniting structured online courses, smart examinations, student analytics, and an AI learning assistant.",
  applicationName: "Learnix",
  keywords: [
    "Learnix",
    "AI education platform",
    "online courses",
    "smart examinations",
    "AI learning assistant",
    "student analytics",
    "LMS",
  ],
  openGraph: {
    type: "website",
    siteName: "Learnix",
    title: "Learnix | AI-Powered Educational Platform",
    description:
      "Structured online courses, smart examinations, real-time analytics, and a context-aware AI tutor inside one secure learning environment.",
    url: siteUrl,
    locale: "en_US",
    alternateLocale: ["ar_SA", "de_DE", "it_IT", "fr_FR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learnix | AI-Powered Educational Platform",
    description:
      "Structured online courses, smart examinations, real-time analytics, and a context-aware AI tutor inside one secure learning environment.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F8F7" },
    { media: "(prefers-color-scheme: dark)", color: "#17181A" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      data-sidebar-state="expanded"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <PreferencesScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <LocaleProvider>
            {children}
            <Toaster />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
