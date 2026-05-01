import Link from "next/link";
import { Container } from "@/components/marketing/container";
import { isExternalHref, mailtoHref, siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="font-display text-2xl text-foreground">
              {siteConfig.companyName}
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Udvikling og drift af platforme, webapps og hosting — med fokus på
              kvalitet, tempo og tydelig kommunikation.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
              <Link
                href={siteConfig.bookingUrl}
                className="font-medium text-accent hover:underline"
                {...(isExternalHref(siteConfig.bookingUrl)
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                Book et møde
              </Link>
              <Link
                href={mailtoHref("Henvendelse fra mags.dk")}
                className="font-medium text-accent hover:underline"
              >
                {siteConfig.contactEmail}
              </Link>
            </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-foreground">
              Virksomhedsoplysninger
            </p>
            <p className="font-medium text-foreground">{siteConfig.legalName}</p>
            <p>CVR {siteConfig.cvr}</p>
            <p>{siteConfig.nace}</p>
            <p className="pt-2">
              {siteConfig.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <p className="pt-2 text-xs">
              Fuldt ansvarlig deltager: {siteConfig.owner}
            </p>
            <p className="pt-4 text-xs text-muted-foreground/80">
              © {new Date().getFullYear()} {siteConfig.legalName}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
