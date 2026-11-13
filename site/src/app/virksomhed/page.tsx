import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/container";
import { Section } from "@/components/marketing/section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Virksomhedsoplysninger",
  description: `Officielle oplysninger om ${siteConfig.legalName}, CVR ${siteConfig.cvr}.`,
};

export default function VirksomhedPage() {
  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1">
        <Section className="pt-12 sm:pt-16">
          <Container className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
              Virksomhed
            </p>
            <h1 className="mt-4 font-display text-4xl text-foreground sm:text-5xl">
              Virksomhedsoplysninger
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Her er de oplysninger du typisk skal bruge til fakturaer,
              kontrakter og leverandørregistrering.
            </p>

            <dl className="mt-12 space-y-8 border-t border-border pt-12">
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Juridisk navn
                </dt>
                <dd className="mt-2 text-lg font-medium text-foreground">
                  {siteConfig.legalName}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  CVR
                </dt>
                <dd className="mt-2 text-lg font-medium text-foreground">
                  {siteConfig.cvr}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Selskabsform
                </dt>
                <dd className="mt-2 text-lg text-foreground">
                  Enkeltmandsvirksomhed
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Fuldt ansvarlig deltager
                </dt>
                <dd className="mt-2 text-lg text-foreground">
                  {siteConfig.owner}
                </dd>
              </div>
            </dl>

            <p className="mt-12 text-sm text-muted-foreground">
              Kilde: CVR/Virk (oplysninger bør altid verificeres der).{" "}
              <Link href="/" className="font-medium text-accent hover:underline">
                Tilbage til forsiden
              </Link>
            </p>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
