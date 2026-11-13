"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  action: string;
  language: string;
  size: "flexible" | "compact";
  theme: "light";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (id: string) => void;
};

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!scriptReady || !container.current) return;
    const api = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    const target = container.current;
    if (!api) return;
    let active = true;
    let widget: string | undefined;

    api.ready(() => {
      if (!active) return;
      try {
        widget = api.render(target, {
          sitekey: siteKey,
          action: "booking",
          language: "da",
          size: target.clientWidth < 300 ? "compact" : "flexible",
          theme: "light",
          callback(token) {
            if (!active) return;
            onToken(token);
            setFailed(false);
          },
          "expired-callback"() {
            if (active) onToken("");
          },
          "timeout-callback"() {
            if (active) onToken("");
          },
          "error-callback"() {
            if (!active) return;
            onToken("");
            setFailed(true);
          },
        });
      } catch {
        setFailed(true);
      }
    });

    return () => {
      active = false;
      if (widget !== undefined) api.remove(widget);
    };
  }, [onToken, scriptReady, siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={container} className="min-h-[65px]" />
      {failed && <p role="status" className="text-sm text-muted-foreground">Kontrollen kunne ikke indlæses. Genindlæs siden, eller aftal mødet på mail.</p>}
    </>
  );
}
