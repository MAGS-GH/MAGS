"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";

const chapters = [
  {
    id: "forespoergsel",
    name: "Forespørgsel",
    progress: 0.22,
    title: "En ny forespørgsel lander",
    description: "Kunden udfylder en formular. Oplysningerne går direkte videre, så ingen skal kopiere dem fra en mail.",
  },
  {
    id: "kundeoverblik",
    name: "Kundeoverblik",
    progress: 0.46,
    title: "Find kunden, opret sagen",
    description: "Systemet genkender kunden og lægger forespørgslen på den rigtige sag. Alle arbejder videre med de samme oplysninger.",
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
    title: "Send invitationen, og fordel arbejdet",
    description: "Kunden får sin invitation, og den rette medarbejder får en opfølgningsopgave. De får hver især det, de skal bruge.",
  },
] as const;

const frames = ["/workshop/overview.webp", ...chapters.map(({ id }) => "/workshop/" + id + ".webp")];

type Workshop = ReturnType<typeof import("@/components/workshop/scene").mountWorkshop>;

export function WorkshopStory() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const scene = useRef<Workshop | null>(null);
  const progress = useRef(0);
  const occupiedRef = useRef(false);
  const activeRef = useRef(-1);
  const visible = useRef(true);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(-1);
  const [occupied, setOccupied] = useState(false);
  const [staticView, setStaticView] = useState(false);

  useEffect(() => {
    if (!canvas.current || !stage.current || !intro.current) return;
    const surface = canvas.current;
    const stageElement = stage.current;
    const introElement = intro.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let loading = false;
    let unavailable = false;
    let animationFrame = 0;
    let loadFrame = 0;

    const draw = () => {
      animationFrame = 0;
      if (document.hidden) return;
      const trigger = stageElement.getBoundingClientRect().top;
      const stops = [
        { position: introElement.getBoundingClientRect().top, progress: 0 },
        ...chapters.map((chapter, index) => ({
          position: sections.current[index]?.getBoundingClientRect().top ?? Infinity,
          progress: chapter.progress,
        })),
      ];

      let current = 0;
      for (let index = 1; index < stops.length; index++) {
        if (trigger + 2 >= stops[index].position) current = index;
        else break;
      }
      const from = stops[current];
      const to = stops[current + 1];
      let value = from.progress;
      if (to && Number.isFinite(to.position)) {
        const distance = to.position - from.position;
        // Give each chapter time to be read before the camera takes off again.
        const start = from.position + distance * (current === 0 ? 0 : 0.33);
        const fraction = Math.max(0, Math.min(1, (trigger - start) / Math.max(1, to.position - start)));
        value += (to.progress - from.progress) * fraction;
      }
      progress.current = value;
      stageElement.dataset.progress = value.toFixed(3);
      if (current - 1 !== activeRef.current) {
        activeRef.current = current - 1;
        setActive(current - 1);
      }
      if (visible.current) scene.current?.render(value, occupiedRef.current);
    };

    const schedule = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(draw);
    };

    const stopScene = () => {
      scene.current?.dispose();
      scene.current = null;
      setLive(false);
    };

    const startScene = async () => {
      if (loading || unavailable || scene.current || staticView || reducedMotion.matches || !visible.current || document.hidden) return;
      loading = true;
      try {
        const { mountWorkshop } = await import("@/components/workshop/scene");
        if (disposed || reducedMotion.matches || !visible.current || document.hidden) return;
        scene.current = mountWorkshop(surface, () => {
          unavailable = true;
          stopScene();
        });
        draw();
        setLive(true);
      } catch {
        unavailable = true;
        stopScene();
      } finally {
        loading = false;
      }
    };

    const refreshMotion = () => {
      if (reducedMotion.matches) stopScene();
      else void startScene();
      schedule();
    };
    const refreshVisibility = () => {
      if (!document.hidden) void startScene();
      schedule();
    };

    const intersection = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) {
        void startScene();
        schedule();
      }
    });
    intersection.observe(stageElement);
    const resize = new ResizeObserver(schedule);
    resize.observe(stageElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", refreshVisibility);
    reducedMotion.addEventListener("change", refreshMotion);
    loadFrame = requestAnimationFrame(() => {
      loadFrame = requestAnimationFrame(() => {
        schedule();
        void startScene();
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(loadFrame);
      cancelAnimationFrame(animationFrame);
      intersection.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", refreshVisibility);
      reducedMotion.removeEventListener("change", refreshMotion);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [staticView]);

  function selectScenario(nextOccupied: boolean) {
    setOccupied(nextOccupied);
    occupiedRef.current = nextOccupied;
    if (visible.current && !document.hidden) scene.current?.render(Math.max(progress.current, 0.72), nextOccupied);
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
          <button
            type="button"
            className="motion-toggle text-link"
            onClick={() => { setLive(false); setStaticView(!staticView); }}
          >
            {staticView ? "Vis 3D" : "Vis stillbilleder"}
          </button>
        </div>
      </figure>
      <div className="workshop-chapters">
        {chapters.map((chapter, index) => (
          <article key={chapter.id} id={chapter.id} className="workshop-chapter editorial-shell" ref={(element) => { sections.current[index] = element; }}>
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
          </article>
        ))}
      </div>
    </section>
  );
}
