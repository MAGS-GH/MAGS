import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { JsonLdOrganization } from "@/components/marketing/json-ld";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const title = "MAGS Solutions · Webapps, integrationer og drift";
const description = "Jeg bygger webapps, kobler dine systemer sammen og holder løsningen i drift. Se et eksempel, og book et gratis intromøde.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.domain),
  title: { default: title, template: "%s · MAGS Solutions" },
  description,
  openGraph: { title, description, locale: "da_DK", type: "website", url: siteConfig.domain },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da" className={inter.variable + " " + playfair.variable + " h-full"}>
      <body className="flex min-h-full flex-col">
        <a className="skip-link" href="#indhold">Gå til indhold</a>
        <JsonLdOrganization />
        {children}
      </body>
    </html>
  );
}
