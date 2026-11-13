import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Virksomhedsoplysninger",
  description: `Officielle oplysninger om ${siteConfig.legalName}, CVR ${siteConfig.cvr}.`,
};

const companyDetails = [
  { label: "Juridisk navn", value: siteConfig.legalName },
  { label: "CVR", value: siteConfig.cvr },
  { label: "Selskabsform", value: "Enkeltmandsvirksomhed" },
  { label: "Fuldt ansvarlig deltager", value: siteConfig.owner },
];

export default function VirksomhedPage() {
  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1 bg-[radial-gradient(ellipse_at_top_right,var(--muted),transparent_66%)]">
        <div className="editorial-shell grid max-w-7xl gap-8 py-10 sm:gap-12 sm:py-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16 lg:py-24">
          <div className="min-w-0 self-start">
            <Link href="/" className="text-link text-sm font-semibold">
              <span aria-hidden="true">← </span>Tilbage til forsiden
            </Link>
            <h1 className="mt-5 font-display text-[clamp(1.95rem,5vw,4.75rem)] leading-[1.02] font-semibold tracking-[-0.065em] sm:mt-8">
              Virksomheds<wbr />oplysninger
            </h1>
            <p className="mt-5 max-w-[40ch] leading-relaxed text-muted-foreground sm:text-lg">
              Her er de oplysninger du typisk skal bruge til fakturaer,
              kontrakter og leverandørregistrering.
            </p>
          </div>

          <div className="min-w-0 self-start rounded-2xl border border-border bg-card px-6 py-3 shadow-[0_18px_50px_-32px_var(--accent)] sm:px-9 sm:py-5 lg:mt-11">
            <dl className="divide-y divide-border">
              {companyDetails.map(({ label, value }) => (
                <div key={label} className="grid gap-1 py-4 sm:grid-cols-[1fr_1.45fr] sm:items-baseline sm:gap-4 sm:py-5">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-display text-xl leading-snug font-semibold tracking-tight break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-border py-4 text-xs text-muted-foreground">
              Kilde: CVR/Virk (oplysninger bør altid verificeres der).
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
