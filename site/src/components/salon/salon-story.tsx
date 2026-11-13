"use client";

import { getImageProps } from "next/image";
import { useScrollScene } from "@/components/marketing/use-scroll-scene";
import { SalonBookingStep, useSalonBooking } from "./booking-demo";
import { initialSalonDisplay } from "./display-state";

const chapters = [
  { id: "behandling", name: "Behandling", progress: .22, title: "Hvad skal du have lavet?", description: "Skift behandling, og se varigheden på receptionens skærm." },
  { id: "tid", name: "Tid", progress: .46, title: "Hvornår passer det dig?", description: "Ledige tider hos alle frisører." },
  { id: "frisoer", name: "Frisør", progress: .72, title: "Hvem skal tage din tid?", description: "Vælg en frisør, og se deres portræt i spejlet." },
  { id: "bekraeftelse", name: "Bekræftelse", progress: 1, title: "Aftalen i salonens kalender", description: "Se, hvad kunden får bekræftet, og hvor aftalen lander hos frisøren." },
] as const;

const posters = ["salon", ...chapters.map(({ id }) => id)];

async function loadSalon(canvas: HTMLCanvasElement, onUnavailable: () => void) {
  const { mountSalon } = await import("./scene");
  return mountSalon(canvas, onUnavailable);
}

function SalonPoster({ name, opening = false }: { name: string; opening?: boolean }) {
  const common = { alt: "", sizes: "100vw", className: `salon-poster${opening ? " workshop-overview" : ""}` };
  const { props: desktop } = getImageProps({ ...common, src: `/salon/${name}.webp`, fill: true });
  const { props: mobile } = getImageProps({ ...common, src: `/salon/${name}-mobil.webp`, fill: true });

  return (
    <picture>
      <source media="(max-width: 790px)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
      <img {...desktop} alt="" loading="eager" fetchPriority={opening ? "high" : undefined} />
    </picture>
  );
}

export function SalonStory() {
  const {
    active, canvas, intro, live, sections, stage, staticView, unavailable, setSceneState, toggleStaticView,
  } = useScrollScene(chapters, loadSalon, initialSalonDisplay);
  const booking = useSalonBooking(setSceneState);
  const chapterId = chapters[active]?.id;
  const poster = chapterId === "frisoer" && booking.stylist
    ? `frisoer-${booking.stylist.id}`
    : posters[active + 1];

  return (
    <section className="workshop salon-story" aria-labelledby="salon-title">
      <div ref={intro} className="workshop-intro editorial-shell salon-intro">
        <div className="salon-opening">
          <p className="editorial-kicker">Interaktiv demo</p>
          <h1 id="salon-title">En ledig stol.<br />En booket tid.</h1>
          <p className="salon-lead">Gå ind i salonen, og prøv, hvordan kunder kan booke hos tre frisører med hver deres kalender.</p>
          <a className="primary-action" href="#behandling">Prøv en booking <span aria-hidden="true">↓</span></a>
        </div>
      </div>

      <figure ref={stage} className="workshop-stage salon-stage" data-renderer={live ? "webgl" : "still"} data-chapter={active} data-salon-step={chapterId ?? "start"}>
        <div className="workshop-visual salon-visual" aria-hidden="true">
          <SalonPoster name={posters[0]} opening />
          {!live && active >= 0 && <SalonPoster name={poster} />}
          <canvas ref={canvas} className="workshop-canvas" />
        </div>
        <div className="workshop-controls salon-controls">
          <nav className="workshop-steps" aria-label="Trin i salonbookingen">
            {chapters.map(({ id, name }, index) => (
              <a key={id} href={`#${id}`} aria-current={active === index ? "step" : undefined}>
                <span aria-hidden="true">{index + 1}.</span> {name}
              </a>
            ))}
          </nav>
          <span className="workshop-progress" aria-hidden="true" />
          <button className="motion-toggle text-link" type="button" onClick={toggleStaticView} hidden={unavailable}>
            {staticView ? "Vis 3D" : "Vis stillbilleder"}
          </button>
        </div>
      </figure>

      <div className="workshop-chapters">
        {chapters.map((chapter, index) => (
          <article key={chapter.id} id={chapter.id} className="workshop-chapter editorial-shell" data-scroll-section tabIndex={-1} ref={(element) => { sections.current[index] = element; }}>
            <div className="workshop-chapter-frame">
              <div className="workshop-copy salon-panel">
                <p className="editorial-kicker">0{index + 1} / {chapter.name}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.description}</p>
                <SalonBookingStep chapter={chapter.id} booking={booking} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
