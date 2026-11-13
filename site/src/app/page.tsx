import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { WorkshopStory } from "@/components/marketing/workshop-story";
import { mailtoHref, siteConfig } from "@/lib/site-config";

const services = [
  ["Webapps", "Giv kunderne et sted at booke eller følge deres sag. Giv medarbejderne et værktøj, der passer til måden, de arbejder på."],
  ["Integrationer", "Få f.eks. webshop, regnskab og kundeoverblik til at dele oplysninger, så samme ordre kun skal tastes én gang."],
  ["Drift og cloud", "Få hjælp til hosting, overvågning, backup og opdateringer, så der er en plan, når noget går galt."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="indhold" className="flex-1">
        <WorkshopStory />
        <section id="ydelser" className="editorial-shell editorial-section">
          <div className="section-intro">
            <p className="editorial-kicker">Ydelser</p>
            <h2>Det kan jeg hjælpe med</h2>
          </div>
          <div className="service-index">
            {services.map(([title, description]) => (
              <article key={title}><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </section>

        <section id="samarbejde" className="process-section">
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

        <section id="om" className="editorial-shell editorial-section about-grid">
          <div className="section-intro">
            <p className="editorial-kicker">Om MAGS Solutions</p>
            <h2>Hej, jeg hedder Mathias</h2>
          </div>
          <div>
            <p>Jeg er udvikler og driver MAGS Solutions. Når vi arbejder sammen, taler du direkte med mig om, hvad din virksomhed har brug for, hvordan vi bygger det, og hvordan det skal køre bagefter.</p>
            <Link className="text-link" href="/virksomhed">Se virksomhedsoplysninger</Link>
          </div>
        </section>

        <section id="kontakt" className="contact-band">
          <div className="editorial-shell editorial-section">
            <h2>Hvad vil du gerne automatisere?</h2>
            <p>Fortæl mig, hvad I bruger tid på i dag. På 30 minutter ser vi på, hvor det giver mening at starte.</p>
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
