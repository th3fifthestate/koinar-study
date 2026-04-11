import type { Metadata } from "next";
import { Bodoni_Moda, Literata } from "next/font/google";
import { PageTransition } from "./components/page-transition";
import "./globals.css";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
      className={`${bodoniModa.variable} ${literata.variable} antialiased`}
    >
      <body className="min-h-dvh font-body">
          <PageTransition>{children}</PageTransition>
        </body>
    </html>
  );
}
