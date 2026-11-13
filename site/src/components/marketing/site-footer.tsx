import Link from "next/link";
import { mailtoHref, siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="editorial-shell footer-inner">
        <div>
          <Link className="site-wordmark" href="/">{siteConfig.companyName}</Link>
          <p>Webapps, integrationer og drift.</p>
        </div>
        <nav aria-label="Kontakt og virksomhed">
          <Link className="text-link" href={siteConfig.bookingUrl}>Book et intromøde</Link>
          <a className="text-link" href={mailtoHref()}>{siteConfig.contactEmail}</a>
          <Link className="text-link" href="/virksomhed">Virksomhedsoplysninger</Link>
        </nav>
        <p>© {new Date().getFullYear()} {siteConfig.legalName}<br />CVR {siteConfig.cvr}</p>
      </div>
    </footer>
  );
}
