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
      <main id="indhold" className="flex-1">
        <div className="editorial-shell grid max-w-7xl gap-10 py-12 sm:py-20 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
          <div className="self-start">
            <Link href="/#kontakt" className="text-link text-sm font-semibold text-accent underline underline-offset-4">
              <span aria-hidden="true">← </span>Kontakt
            </Link>
            <h1 className="mt-7 max-w-[12ch] font-display text-4xl leading-tight tracking-tight sm:text-5xl xl:text-6xl">
              Book et gratis intromøde
            </h1>
            <p className="mt-5 max-w-[38ch] leading-relaxed text-muted-foreground">
              Fortæl mig, hvad du vil have til at fungere bedre. På 30 minutter finder vi ud af, hvor det giver mening at starte.
            </p>
            <dl className="mt-7 grid max-w-sm grid-cols-3 gap-2 border-y border-border py-4 text-sm sm:gap-4">
              <div>
                <dt className="text-muted-foreground">Varighed</dt>
                <dd className="mt-1 font-semibold">30 min.</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mødested</dt>
                <dd className="mt-1 font-semibold">Teams</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tidszone</dt>
                <dd className="mt-1 font-semibold">Dansk tid</dd>
              </div>
            </dl>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Skriv til <a href={mailHref} className="font-semibold text-accent underline underline-offset-4">{siteConfig.contactEmail}</a> for at ændre eller aflyse dit møde.
            </p>
          </div>

          {booking ? (
            <div>
              <BookingCalendar siteKey={booking.siteKey} fake={booking.fake} mailHref={mailHref} />
              <noscript>
                <p className="mt-4 text-sm text-muted-foreground">
                  Onlinebooking kræver JavaScript. <a href={mailHref} className="font-semibold text-accent underline">Aftal et møde på mail</a>.
                </p>
              </noscript>
            </div>
          ) : (
            <section aria-labelledby="booking-contact" className="self-start rounded-2xl border border-border bg-card p-5 sm:p-8">
              <h2 id="booking-contact" className="font-display text-2xl sm:text-3xl">Aftal et møde på mail</h2>
              <p className="mt-3 max-w-[45ch] leading-relaxed text-muted-foreground">
                Onlinebooking er midlertidigt utilgængelig. Skriv gerne, hvad du vil tale om, og hvornår det passer dig.
              </p>
              <a href={mailHref} className="primary-action mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground">
                Skriv til {siteConfig.contactEmail}
              </a>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
