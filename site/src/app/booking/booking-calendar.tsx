"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Turnstile } from "./turnstile";

type Slot = { start: string; end: string };
type Day = { date: string; slots: Slot[] };
type Availability = { timeZone: string; days: Day[] };
type Attempt = {
  start: string;
  name: string;
  email: string;
  turnstileToken: string;
  idempotencyKey: string;
};

const dateFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  month: "long",
  day: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  month: "short",
  day: "numeric",
});
const weekdayFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "short",
});
const clockFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
});

function atNoon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function timeLabel(slot: Slot) {
  return `${clockFormat.format(new Date(slot.start))}–${clockFormat.format(new Date(slot.end))}`;
}

function errorMessage(code: string, status: number) {
  if (code === "slot_unavailable") return "Den valgte tid er lige blevet optaget. Vælg en anden tid.";
  if (code === "verification_failed") return "Kontrollen udløb. Prøv igen, når den er klar.";
  if (code === "idempotency_conflict") return "Vælg tiden igen for at sende en ny booking.";
  if (code === "not_created") return "Mødet blev ikke oprettet. Prøv igen, eller aftal et møde på mail.";
  if (code === "invalid_request" || status === 400) return "Tjek dit navn, din e-mail og den valgte tid.";
  if (status === 429) return "Der er sendt flere forsøg på kort tid. Vent lidt, og prøv igen.";
  return "Vi kunne ikke bekræfte bookingen lige nu. Kontrollér status igen, eller skriv til os.";
}

const outlineButton = "min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-accent hover:border-accent disabled:cursor-default disabled:opacity-40";
const solidButton = "primary-action min-h-11 cursor-pointer disabled:cursor-default disabled:opacity-50";
const inputClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-base";

export function BookingCalendar({ siteKey, fake, mailHref }: { siteKey?: string; fake: boolean; mailHref: string }) {
  const [availability, setAvailability] = useState<Availability>();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [datePage, setDatePage] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [widgetVersion, setWidgetVersion] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();
  const [confirmed, setConfirmed] = useState<Slot>();
  const confirmation = useRef<HTMLHeadingElement>(null);
  const attemptStatus = useRef<HTMLParagraphElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const submittingRef = useRef(false);
  const activeAttemptKey = attempt?.idempotencyKey;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/booking/availability", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("availability");
        const data: Availability = await response.json();
        if (!Array.isArray(data.days)) throw new Error("availability format");
        if (controller.signal.aborted) return;
        setAvailability(data);
        setLoadFailed(false);
        if (refresh === 0) {
          const firstAvailable = data.days.findIndex((day) => day.slots.length > 0);
          if (firstAvailable >= 0) setDatePage(Math.floor(firstAvailable / 7));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (confirmed) confirmation.current?.focus();
  }, [confirmed]);

  useEffect(() => {
    if (activeAttemptKey) attemptStatus.current?.focus();
  }, [activeAttemptKey]);

  useEffect(() => {
    if (!activeAttemptKey && feedback?.error) alert.current?.focus();
  }, [activeAttemptKey, feedback]);

  const days = availability?.days ?? [];
  const visibleDays = days.slice(datePage * 7, datePage * 7 + 7);
  const day = visibleDays.find((item) => item.date === selectedDay) ?? visibleDays.find((item) => item.slots.length > 0);
  const slot = day?.slots.find((item) => item.start === selectedStart);
  const requiresToken = Boolean(siteKey) && !fake;

  function reload() {
    setLoading(true);
    setLoadFailed(false);
    setRefresh((value) => value + 1);
  }

  function resetVerification() {
    setToken("");
    setWidgetVersion((version) => version + 1);
  }

  function moveDates(direction: -1 | 1) {
    setDatePage((page) => page + direction);
    setSelectedDay("");
    setSelectedStart("");
    resetVerification();
    setFeedback(undefined);
  }

  async function submitReservation(reservation: Attempt) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(undefined);
    setAttempt(reservation);

    try {
      const response = await fetch("/api/booking/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reservation),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();

      if (response.status === 202) {
        setFeedback({ text: "Vi afventer kalenderens bekræftelse. Kontrollér status om et øjeblik.", error: false });
        return;
      }
      if (response.ok && typeof result?.start === "string" && typeof result?.end === "string") {
        setConfirmed({ start: result.start, end: result.end });
        setAttempt(undefined);
        setName("");
        setEmail("");
        return;
      }

      setFeedback({ text: errorMessage(result?.code, response.status), error: true });
      const confirmedNoWrite = result?.code === "not_created";
      if (!confirmedNoWrite && (response.status >= 500 || (attempt && response.status === 429))) return;
      setAttempt(undefined);
      resetVerification();
      if (result?.code === "slot_unavailable" || result?.code === "idempotency_conflict") {
        setSelectedStart("");
        reload();
      }
    } catch {
      setFeedback({ text: errorMessage("unavailable", 503), error: true });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || (requiresToken && !token)) return;
    void submitReservation({
      start: slot.start,
      name: name.trim(),
      email: email.trim(),
      turnstileToken: token,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <section aria-labelledby="calendar-title" className="self-start rounded-2xl border border-border bg-card p-4 shadow-[0_18px_50px_-32px_var(--accent)] sm:p-8">
      {confirmed ? (
        <>
          <h2 id="calendar-title" ref={confirmation} tabIndex={-1} className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {fake ? "Testbooking gennemført" : "Dit møde er booket"}
          </h2>
          <p className="mt-5 border-y border-border py-3 font-display text-xl font-semibold tracking-tight text-accent">
            <time dateTime={confirmed.start}>{dateFormat.format(new Date(confirmed.start))} kl. {timeLabel(confirmed)}</time>
          </p>
          <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
            {fake ? "Dette er en test af bookingforløbet." : "Outlook sender kalenderinvitationen med Teams-link til den e-mail, du angav."}
          </p>
        </>
      ) : (
        <>
          <h2 id="calendar-title" className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Vælg dato og tid</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tider vises i dansk tid. Du kan booke mindst 24 timer før mødet.</p>

          {feedback && (
            <p ref={alert} tabIndex={-1} role={feedback.error ? "alert" : "status"} className="mt-5 rounded-lg bg-muted p-3 text-sm leading-relaxed">
              {feedback.text}
            </p>
          )}

          {attempt ? (
            <div className="mt-5">
              <p ref={attemptStatus} tabIndex={-1} className="text-sm font-semibold">{dateFormat.format(new Date(attempt.start))} kl. {clockFormat.format(new Date(attempt.start))}</p>
              <button type="button" onClick={() => void submitReservation(attempt)} disabled={submitting} className={`${solidButton} mt-4`}>
                {submitting ? "Kontrollerer booking…" : "Kontrollér bookingstatus"}
              </button>
              <p className="mt-4 text-sm text-muted-foreground">Har du brug for hjælp? <a href={mailHref} className="text-link font-semibold text-accent underline">Skriv til MAGS</a>.</p>
            </div>
          ) : loadFailed ? (
            <div className="mt-6">
              <p role="alert" className="text-sm">Kalenderen er midlertidigt utilgængelig.</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button type="button" onClick={reload} className={outlineButton}>Prøv igen</button>
                <a href={mailHref} className="text-link text-sm font-semibold text-accent underline">Aftal et møde på mail</a>
              </div>
            </div>
          ) : loading ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">Henter ledige tider…</p>
          ) : !days.some((item) => item.slots.length > 0) ? (
            <p role="status" className="mt-6 text-sm leading-relaxed">
              Der er ingen ledige tider de næste 30 dage. <a href={mailHref} className="text-link font-semibold text-accent underline">Skriv til MAGS</a> for at finde en tid.
            </p>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
                <button type="button" aria-label="Forrige syv dage" onClick={() => moveDates(-1)} disabled={datePage === 0} className={outlineButton}>←</button>
                <p aria-live="polite" className="text-center font-display text-lg leading-tight font-semibold">
                  {visibleDays.length > 0 && shortDateFormat.formatRange(atNoon(visibleDays[0].date), atNoon(visibleDays[visibleDays.length - 1].date))}
                </p>
                <button type="button" aria-label="Næste syv dage" onClick={() => moveDates(1)} disabled={(datePage + 1) * 7 >= days.length} className={outlineButton}>→</button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Datoer">
                {visibleDays.map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    aria-label={`${dateFormat.format(atNoon(item.date))}${item.slots.length === 0 ? ", ingen ledige tider" : ""}`}
                    aria-pressed={day?.date === item.date}
                    disabled={item.slots.length === 0}
                    className={`${outlineButton} min-h-[3.35rem] px-1 text-center aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground`}
                    onClick={() => {
                      setSelectedDay(item.date);
                      setSelectedStart("");
                      resetVerification();
                      setFeedback(undefined);
                    }}
                  >
                    <span className="block text-xs font-normal">{weekdayFormat.format(atNoon(item.date))}</span>
                    <span className="mt-0.5 block font-display text-lg leading-none tabular-nums">{atNoon(item.date).getUTCDate()}</span>
                  </button>
                ))}
              </div>

              {day ? (
                <fieldset className="mt-6 min-w-0">
                  <legend className="text-sm font-semibold">Ledige tider {dateFormat.format(atNoon(day.date))}</legend>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {day.slots.map((item) => (
                      <label key={item.start} className="block">
                        <input
                          type="radio"
                          name="booking-start"
                          value={item.start}
                          checked={selectedStart === item.start}
                          onChange={() => {
                            setSelectedStart(item.start);
                            setFeedback(undefined);
                          }}
                          className="peer sr-only"
                        />
                        <span className={`${outlineButton} flex items-center justify-center px-1 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent`}>
                          {clockFormat.format(new Date(item.start))}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p role="status" className="mt-5 text-sm text-muted-foreground">Ingen ledige tider i denne periode. Prøv den næste periode.</p>
              )}

              {slot && (
                <form onSubmit={handleSubmit} className="mt-7 rounded-xl border border-border bg-background p-4 sm:p-5">
                  <p className="font-display text-lg leading-tight font-semibold tracking-tight">Du har valgt {dateFormat.format(new Date(slot.start))} kl. {timeLabel(slot)}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Dit navn
                      <input name="name" autoComplete="name" required maxLength={100} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <label className="block text-sm font-semibold">
                      Din e-mail
                      <input type="email" name="email" autoComplete="email" required maxLength={254} className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
                    </label>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    {fake
                      ? "Brug testoplysninger til at afprøve bookingforløbet."
                      : "Vi bruger dit navn og din e-mail til at oprette mødet i Microsoft 365 og sende invitationen."}
                  </p>
                  {requiresToken && siteKey && (
                    <div className="mt-4">
                      <Turnstile key={widgetVersion} siteKey={siteKey} onToken={setToken} />
                    </div>
                  )}
                  <button type="submit" disabled={requiresToken && !token} className={`${solidButton} mt-4`}>
                    {fake ? "Gennemfør testbooking" : "Bekræft møde"}
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
