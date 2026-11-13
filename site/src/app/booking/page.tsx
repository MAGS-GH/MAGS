import type { Metadata } from "next";
import Link from "next/link";
import { readBookingConfig } from "@/app/api/booking/config";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { mailtoHref, siteConfig } from "@/lib/site-config";
import { BookingCalendar } from "./booking-calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book et gratis intromøde",
  description: "Vælg en tid til 30 minutters intromøde på Teams med MAGS Solutions.",
};

export default function BookingPage() {
  const booking = readBookingConfig();
  const mailHref = mailtoHref("Intromøde med MAGS Solutions");

  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1 bg-[radial-gradient(ellipse_at_top_right,var(--muted),transparent_66%)]">
        <div className="editorial-shell grid max-w-7xl gap-8 py-10 sm:gap-12 sm:py-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16 lg:py-24">
          <div className="self-start">
            <Link href="/#kontakt" className="text-link text-sm font-semibold">
              <span aria-hidden="true">← </span>Kontakt
            </Link>
            <h1 className="mt-5 max-w-[13ch] text-balance font-display text-[clamp(2.65rem,5.4vw,5.25rem)] leading-[1.02] font-semibold tracking-[-0.065em] sm:mt-8">
              Book et gratis intromøde
            </h1>
            <p className="mt-5 max-w-[40ch] leading-relaxed text-muted-foreground sm:text-lg">
              Fortæl mig, hvad du vil have til at fungere bedre. På 30 minutter finder vi ud af, hvor det giver mening at starte.
            </p>
            <dl className="mt-7 grid max-w-[27rem] grid-cols-3 gap-3 border-y border-border py-4 text-sm sm:mt-9">
              <div>
                <dt className="text-xs text-muted-foreground">Varighed</dt>
                <dd className="mt-1.5 font-semibold">30 min.</dd>
              </div>
              <div className="border-l border-border pl-3 sm:pl-4">
                <dt className="text-xs text-muted-foreground">Mødested</dt>
                <dd className="mt-1.5 font-semibold">Teams</dd>
              </div>
              <div className="border-l border-border pl-3 sm:pl-4">
                <dt className="text-xs text-muted-foreground">Tidszone</dt>
                <dd className="mt-1.5 font-semibold">Dansk tid</dd>
              </div>
            </dl>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Skriv til <a href={mailHref} className="text-link font-semibold">{siteConfig.contactEmail}</a> for at ændre eller aflyse dit møde.
            </p>
          </div>

          <div className="min-w-0 self-start lg:mt-11">
            {booking ? (
              <>
                <BookingCalendar siteKey={booking.siteKey} fake={booking.fake} mailHref={mailHref} />
                <noscript>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Onlinebooking kræver JavaScript. <a href={mailHref} className="text-link font-semibold">Aftal et møde på mail</a>.
                  </p>
                </noscript>
              </>
            ) : (
              <section aria-labelledby="booking-contact" className="rounded-2xl border border-border bg-card p-6 shadow-[0_18px_50px_-32px_var(--accent)] sm:p-9">
                <h2 id="booking-contact" className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Aftal et møde på mail</h2>
                <p className="mt-4 max-w-[45ch] leading-relaxed text-muted-foreground">
                  Onlinebooking er midlertidigt utilgængelig. Skriv gerne, hvad du vil tale om, og hvornår det passer dig.
                </p>
                <a href={mailHref} className="primary-action mt-6">
                  Skriv til {siteConfig.contactEmail}
                </a>
              </section>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
