import type { Metadata } from "next";
import { Fraunces, Literata, Geist } from "next/font/google";
import { Toaster } from "sonner";
import { PageTransition } from "./components/page-transition";
import { FooterGate } from "@/components/layout/footer-gate";
import { CookieBanner } from "@/components/layout/cookie-banner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  weight: "variable",
  style: ["normal", "italic"],
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: "Koinar — Bible Study in Deep Fellowship",
  description:
    "In-depth Bible studies in historical, linguistic, and canonical context — read together by an invited community. Coming soon.",
  openGraph: {
    title: "Koinar",
    description:
      "In-depth Bible studies in full context, shared in real community. Coming soon.",
    siteName: "Koinar",
    url: "/",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/images/10-roundtable-study.jpeg",
        width: 1440,
        height: 960,
        alt: "A communal Bible study table with open Bibles and coffee",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Koinar — Bible Study in Deep Fellowship",
    description:
      "In-depth Bible studies in full context, shared in real community. Coming soon.",
    images: ["/images/10-roundtable-study.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased", fraunces.variable, literata.variable, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-body">
        <PageTransition>{children}</PageTransition>
        <FooterGate />
        <CookieBanner />
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
