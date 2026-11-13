import type { Metadata } from "next";
import Link from "next/link";
import { SectionScroll } from "@/components/marketing/section-scroll";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SalonStory } from "@/components/salon/salon-story";
import { siteConfig } from "@/lib/site-config";
import "./salon.css";

const title = "Booking til frisørsaloner";
const description = "Gå gennem en 3D-frisørsalon, og prøv at booke en behandling hos én af tre frisører med hver deres kalender.";
const url = "/eksempler/frisoersalon";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url, locale: "da_DK", type: "website", images: ["/salon/salon.webp"] },
};

export default function SalonPage() {
  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1">
        <SectionScroll />
        <SalonStory />
        <section className="salon-contact">
          <div className="editorial-shell editorial-section">
            <p className="editorial-kicker">Booking til din salon</p>
            <h2>Hvordan booker kunderne hos jer?</h2>
            <p>Fortæl om jeres behandlinger, medarbejdere og kalendere. Så ser vi på, hvordan et bookingflow kan passe ind i jeres hverdag.</p>
            <div className="contact-actions">
              <Link href={siteConfig.bookingUrl} className="primary-action">Book et gratis intromøde</Link>
              <Link href="/#ydelser" className="text-link">Se MAGS’ ydelser</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
