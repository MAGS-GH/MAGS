import Image from "next/image";
import Link from "next/link";
import { SectionScroll } from "@/components/marketing/section-scroll";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { WorkshopStory } from "@/components/marketing/workshop-story";
import { mailtoHref, siteConfig } from "@/lib/site-config";

const services = [
  ["Webapps", "Fra formularen i eksemplet til en kundeportal eller et internt værktøj. Jeg bygger en løsning, der passer til jeres måde at arbejde på.", "Kundeportaler og interne værktøjer"],
  ["Integrationer", "Lad webshop, regnskab og kundeoverblik dele oplysninger. Når en ordre kommer ind, kan den gå videre til de rigtige steder automatisk.", "Data mellem jeres systemer"],
  ["Drift og cloud", "Jeg hjælper med hosting, overvågning, backup og opdateringer, så I ved, hvem der tager fat, hvis noget går galt.", "Fra lancering til daglig drift"],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1">
        <SectionScroll />
        <WorkshopStory />
        <section id="ydelser" className="services-section" data-scroll-section tabIndex={-1}>
          <div className="editorial-shell editorial-section">
            <div className="workshop-handoff">
              <div className="section-intro">
                <p className="editorial-kicker">Ydelser</p>
                <h2>Få jeres systemer til at arbejde sammen</h2>
                <p className="service-lead">Har I et trin, hvor nogen altid skal taste det samme igen eller huske at sende noget videre? Det er et godt sted at starte.</p>
              </div>
              <div className="handoff-image">
                <Image src="/workshop/forbindelser.webp" alt="" fill sizes="(max-width: 790px) 100vw, 52vw" />
              </div>
            </div>
            <div className="service-index">
              {services.map(([title, description, example]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <p className="service-example">{example}</p>
                </article>
              ))}
            </div>
            <Link href="/eksempler/frisoersalon" className="group mt-9 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-[1fr_minmax(0,42%)]">
              <div className="self-center p-6 sm:p-9">
                <p className="editorial-kicker">Interaktiv demo</p>
                <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Booking til frisørsaloner</h3>
                <p className="mt-3 max-w-[42ch] text-muted-foreground">Træd ind i salonen og prøv at booke en behandling på tværs af tre frisørers kalendere.</p>
                <span className="text-link mt-4 inline-block font-semibold group-hover:text-ring">Prøv 3D-salonen <span aria-hidden="true">↗</span></span>
              </div>
              <div className="relative aspect-[2/1] sm:aspect-auto sm:min-h-56">
                <Image src="/salon/salon.webp" alt="" fill sizes="(max-width: 639px) 92vw, 40vw" className="object-cover" />
              </div>
            </Link>
          </div>
        </section>

        <section id="samarbejde" className="process-section" data-scroll-section tabIndex={-1}>
          <div className="editorial-shell editorial-section process-grid">
            <div className="section-intro">
              <p className="editorial-kicker">Samarbejde</p>
              <h2>Fra arbejdsgang til løsning</h2>
            </div>
            <ol>
              <li><div><h3>Find det, der tager tid</h3><p>Vi ser på jeres arbejdsgang og vælger den første opgave, det giver mening at løse.</p></div></li>
              <li><div><h3>Prøv løsningen tidligt</h3><p>Jeg bygger første brugbare version, og vi justerer sammen ud fra, hvordan den fungerer i praksis.</p></div></li>
              <li><div><h3>Få den sikkert i drift</h3><p>Jeg hjælper med at sætte løsningen i drift og aftaler med jer, hvem der står for vedligeholdelsen.</p></div></li>
            </ol>
          </div>
        </section>

        <section id="om" className="editorial-shell editorial-section about-grid" data-scroll-section tabIndex={-1}>
          <div className="section-intro">
            <p className="editorial-kicker">Om MAGS Solutions</p>
            <h2>Hej, jeg hedder Mathias</h2>
          </div>
          <div>
            <p>Jeg er udvikler og driver MAGS Solutions. Når vi arbejder sammen, taler du direkte med mig om, hvad din virksomhed har brug for, hvordan vi bygger det, og hvordan det skal køre bagefter.</p>
            <Link className="text-link" href="/virksomhed">Se virksomhedsoplysninger</Link>
          </div>
        </section>

        <section id="kontakt" className="contact-band" data-scroll-section tabIndex={-1}>
          <div className="editorial-shell editorial-section">
            <h2>Hvad skal fylde mindre i jeres arbejdsdag?</h2>
            <p>Tag én konkret arbejdsgang med til et gratis intromøde. På 30 minutter ser vi på, hvor det giver mening at starte.</p>
            <div className="contact-actions">
              <Link href={siteConfig.bookingUrl} className="primary-action">Book et gratis intromøde</Link>
              <a href={mailtoHref("Henvendelse fra mags.dk")} className="text-link">Skriv til {siteConfig.contactEmail}</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
