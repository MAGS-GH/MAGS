import type { Metadata } from "next";
import { Calistoga, Inter, JetBrains_Mono } from "next/font/google";
import { JsonLdOrganization } from "@/components/marketing/json-ld";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const calistoga = Calistoga({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-calistoga",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.domain),
  title: {
    default: `${siteConfig.companyName} · Udvikling og drift af platforme`,
    template: `%s · ${siteConfig.companyName}`,
  },
  description:
    "MAGS Solutions — udvikling og drift af platforme, webapps og hosting. TypeScript, iterationer og tæt samarbejde.",
  openGraph: {
    title: `${siteConfig.companyName} · Udvikling og drift af platforme`,
    description:
      "Byg og drift software med tydelige mål: hurtigere leverancer, stabil drift og skalerbar arkitektur.",
    locale: "da_DK",
    type: "website",
    url: siteConfig.domain,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${inter.variable} ${calistoga.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLdOrganization />
        {children}
      </body>
    </html>
  );
}
