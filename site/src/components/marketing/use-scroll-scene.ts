"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScrollScene<State> = {
  render(progress: number, state: State, elapsed: number): boolean | void;
  dispose(): void;
};

type LoadScene<State> = (canvas: HTMLCanvasElement, onUnavailable: () => void) => Promise<ScrollScene<State>>;

export function useScrollScene<State>(
  chapters: readonly { progress: number }[],
  loadScene: LoadScene<State>,
  initialState: State,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const sceneState = useRef(initialState);
  const requestDraw = useRef<() => void>(null);
  const progress = useRef(0);
  const activeRef = useRef(-1);
  const [active, setActive] = useState(-1);
  const [live, setLive] = useState(false);
  const [staticView, setStaticView] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!canvas.current || !stage.current || !intro.current) return;
    const surface = canvas.current;
    const stageElement = stage.current;
    const introElement = intro.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let loading = false;
    let failed = false;
    let visible = false;
    let painted = false;
    let ready = false;
    let scene: ScrollScene<State> | null = null;
    let animationFrame = 0;
    let loadFrame = 0;
    let lastFrame: number | null = null;

    function draw(now: number) {
      animationFrame = 0;
      if (document.hidden) {
        lastFrame = null;
        return;
      }
      const trigger = stageElement.getBoundingClientRect().top;
      const stops = [
        { position: introElement.getBoundingClientRect().top, progress: 0, hold: 0 },
        ...chapters.map((chapter, index) => {
          const section = sections.current[index];
          const bounds = section?.getBoundingClientRect();
          const frame = section?.firstElementChild?.getBoundingClientRect();
          return {
            position: bounds?.top ?? Infinity,
            progress: chapter.progress,
            hold: bounds && frame ? bounds.height - frame.height : 0,
          };
        }),
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
        // Use the physical scroll distance where the chapter card stays pinned.
        const start = from.position + from.hold;
        const fraction = Math.max(0, Math.min(1, (trigger - start) / Math.max(1, to.position - start)));
        value += (to.progress - from.progress) * fraction;
      }
      const canRender = visible && scene && !reducedMotion.matches;
      const elapsed = lastFrame === null ? 0 : Math.min(50, now - lastFrame);
      const gap = value - progress.current;
      const settling = canRender && lastFrame !== null && Math.abs(gap) >= 0.001;
      progress.current = settling ? progress.current + gap * -Math.expm1(-elapsed / 145) : value;
      lastFrame = canRender ? now : null;
      stageElement.dataset.progress = progress.current.toFixed(3);
      stageElement.style.setProperty("--workshop-progress", String(progress.current));
      if (current - 1 !== activeRef.current) {
        activeRef.current = current - 1;
        setActive(current - 1);
      }
      const sceneMoving = canRender && scene?.render(progress.current, sceneState.current, elapsed || 16);
      if (canRender && !ready) {
        ready = true;
        setLive(true);
      }
      if (settling || sceneMoving) schedule();
    }

    function schedule() {
      if (!animationFrame) animationFrame = requestAnimationFrame(draw);
    }
    requestDraw.current = schedule;

    function stopScene() {
      scene?.dispose();
      scene = null;
      lastFrame = null;
      ready = false;
      setLive(false);
    }

    function failScene() {
      failed = true;
      stopScene();
      setUnavailable(true);
    }

    function canLoad() {
      return painted && visible && !document.hidden && !reducedMotion.matches && !staticView && !failed;
    }

    async function startScene() {
      if (disposed || loading || scene || !canLoad()) return;
      loading = true;
      try {
        const loaded = await loadScene(surface, () => { if (!disposed) failScene(); });
        if (disposed || !canLoad()) loaded.dispose();
        else scene = loaded;
        if (!disposed) schedule();
      } catch {
        if (!disposed) failScene();
      } finally {
        loading = false;
      }
    }

    function refreshMotion() {
      if (reducedMotion.matches) stopScene();
      else void startScene();
      schedule();
    }

    function refreshVisibility() {
      lastFrame = null;
      void startScene();
      schedule();
    }

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      refreshVisibility();
    });
    intersection.observe(stageElement);
    const resize = new ResizeObserver(schedule);
    resize.observe(stageElement);
    resize.observe(introElement);
    for (const section of sections.current) {
      if (section) resize.observe(section);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", refreshVisibility);
    reducedMotion.addEventListener("change", refreshMotion);
    loadFrame = requestAnimationFrame(() => {
      loadFrame = requestAnimationFrame(() => {
        painted = true;
        schedule();
        void startScene();
      });
    });

    return () => {
      disposed = true;
      requestDraw.current = null;
      cancelAnimationFrame(loadFrame);
      cancelAnimationFrame(animationFrame);
      intersection.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", refreshVisibility);
      reducedMotion.removeEventListener("change", refreshMotion);
      scene?.dispose();
    };
  }, [chapters, loadScene, staticView]);

  const setSceneState = useCallback((next: State) => {
    sceneState.current = next;
    requestDraw.current?.();
  }, []);

  function toggleStaticView() {
    setLive(false);
    setStaticView((current) => !current);
  }

  return { active, canvas, intro, live, sections, stage, staticView, unavailable, setSceneState, toggleStaticView };
}
