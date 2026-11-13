"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useScrollScene } from "@/components/marketing/use-scroll-scene";
import { siteConfig } from "@/lib/site-config";

const chapters = [
  {
    id: "forespoergsel",
    name: "Forespørgsel",
    progress: 0.22,
    title: "Forespørgslen lander ét sted",
    description: "Kunden udfylder en formular. Oplysningerne går direkte videre, så ingen skal kopiere dem fra en mail.",
  },
  {
    id: "kundeoverblik",
    name: "Kundeoverblik",
    progress: 0.46,
    title: "Find kunden, opret sagen",
    description: "Systemet genkender kunden og opretter en sag med oplysningerne fra formularen. Medarbejderne kan gå i gang med det samme.",
  },
  {
    id: "aftale",
    name: "Aftale",
    progress: 0.72,
    title: "Find en tid, der passer",
    description: "Systemet tjekker kalenderen. Prøv at ændre den første tids status, og se, hvilken tid systemet vælger.",
  },
  {
    id: "opfoelgning",
    name: "Opfølgning",
    progress: 1,
    title: "Alle får det, de skal bruge",
    description: "Kunden får sin invitation. Medarbejderen får en opgave med de oplysninger, der er nødvendige for at følge op.",
  },
] as const;

const frames = ["/workshop/overview.webp", ...chapters.map(({ id }) => "/workshop/" + id + ".webp")];

async function loadWorkshop(canvas: HTMLCanvasElement, onUnavailable: () => void) {
  const { mountWorkshop } = await import("@/components/workshop/scene");
  return mountWorkshop(canvas, onUnavailable);
}

export function WorkshopStory() {
  const {
    active, canvas, intro, live, sections, stage, staticView, setSceneState, toggleStaticView,
  } = useScrollScene(chapters, loadWorkshop, false);
  const [occupied, setOccupied] = useState(false);

  function selectScenario(nextOccupied: boolean) {
    setOccupied(nextOccupied);
    setSceneState(nextOccupied);
  }

  const calendarStill = occupied ? "/workshop/aftale-optaget.webp" : frames[3];

  return (
    <section className="workshop" aria-labelledby="forside-titel">
      <div ref={intro} className="workshop-intro editorial-shell">
        <div className="workshop-opening-copy">
          <div className="hero-rule" aria-hidden="true" />
          <h1 id="forside-titel">Software der gør hverdagen lettere<span>.</span></h1>
          <p>Jeg bygger webapps, kobler dine systemer sammen og holder løsningen i drift.</p>
          <div className="workshop-cta">
            <Link href={siteConfig.bookingUrl} className="primary-action">Book et gratis intromøde</Link>
            <span>30 min. på Teams</span>
          </div>
          <div className="hero-links">
            <a className="text-link" href="#forespoergsel">Følg automatiseringen <span aria-hidden="true">↓</span></a>
            <a className="text-link" href="#ydelser">Gå til ydelser</a>
          </div>
        </div>
      </div>
      <figure ref={stage} className="workshop-stage" data-renderer={live ? "webgl" : "still"} data-chapter={active}>
        <figcaption className="editorial-kicker">Eksempel på en automatisering</figcaption>
        <div className="workshop-visual" aria-hidden="true">
          <Image src={frames[0]} alt="" fill sizes="100vw" preload className="workshop-poster workshop-overview" />
          {!live && active >= 0 && (
            <Image src={active === 2 ? calendarStill : frames[active + 1]} alt="" fill sizes="100vw" className="workshop-poster workshop-frame" />
          )}
          <canvas ref={canvas} className="workshop-canvas" />
        </div>
        <div className="workshop-controls">
          <nav className="workshop-steps" aria-label="Trin i eksemplet">
            {chapters.map(({ id, name }, index) => (
              <a key={id} href={"#" + id} aria-current={active === index ? "step" : undefined}>
                <span aria-hidden="true">{index + 1}.</span> {name}
              </a>
            ))}
          </nav>
          <span className="workshop-progress" aria-hidden="true" />
          <button
            type="button"
            className="motion-toggle text-link"
            onClick={toggleStaticView}
          >
            {staticView ? "Vis 3D" : "Vis stillbilleder"}
          </button>
        </div>
      </figure>
      <div className="workshop-chapters">
        {chapters.map((chapter, index) => (
          <article key={chapter.id} id={chapter.id} className="workshop-chapter editorial-shell" data-scroll-section tabIndex={-1} ref={(element) => { sections.current[index] = element; }}>
            <div className="workshop-chapter-frame">
              <div className="workshop-copy">
                <p className="editorial-kicker">0{index + 1} / {chapter.name}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.description}</p>
                {chapter.id === "aftale" && (
                  <fieldset className="workshop-scenario">
                    <legend>Prøv kalenderen</legend>
                    <div>
                      <button type="button" aria-pressed={!occupied} onClick={() => selectScenario(false)}>Tiden er ledig</button>
                      <button type="button" aria-pressed={occupied} onClick={() => selectScenario(true)}>Tiden er optaget</button>
                    </div>
                    <p aria-live="polite">{occupied ? "Kl. 10.00 er optaget. Næste ledige tid, kl. 10.30, bliver valgt." : "Kl. 10.00 er ledig. Aftalen kan bookes med det samme."}</p>
                  </fieldset>
                )}
                {chapter.id === "opfoelgning" && (
                  <div className="workshop-end">
                    <p>Hvad vil du gerne automatisere?</p>
                    <Link className="primary-action" href={siteConfig.bookingUrl}>Book et gratis intromøde</Link>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
