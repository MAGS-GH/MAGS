"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clock,
  longDate,
  money,
  request,
  type Appointment,
  type Availability,
  type Slot,
} from "../../lib/booking";
import { Times } from "../customer/times";
function listenToLink(change: () => void) {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
}
export default function GuestAppointment() {
  const token = useSyncExternalStore(
    listenToLink,
    () => window.location.hash.slice(1),
    () => null,
  );
  const valid = !!token && /^[a-zA-Z0-9_-]{32,128}$/.test(token);
  if (token === null)
    return (
      <main className="simple">
        <h1>Din aftale</h1>
        <p>Henter aftalen …</p>
      </main>
    );
  if (!valid)
    return (
      <main className="simple">
        <h1>Dit aftalelink mangler</h1>
        <p>Åbn hele det private aftalelink, eller ring til salonen.</p>
      </main>
    );
  return <Receipt key={token} token={token} />;
}
function Receipt({ token }: { token: string }) {
  const [item, setItem] = useState<Appointment>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<Slot>();
  const [staff, setStaff] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    request<Appointment>("/api/guest", { headers: { "X-Aftale": token } })
      .then((i) => {
        if (active) setItem(i);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision, token]);
  async function openMove() {
    setLoading(true);
    setError("");
    setStatus("");
    setSlot(undefined);
    setAvailability(null);
    setMode("move");
    try {
      setAvailability(
        await request<Availability>("/api/guest/availability", {
          headers: { "X-Aftale": token || "" },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save(action: "move" | "cancel") {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await request<Appointment>("/api/guest/" + action, {
        method: "POST",
        headers: {
          "X-Aftale": token || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "move"
            ? { start: slot?.start, staffId: staff || null }
            : {},
        ),
      });
      setItem(data);
      setMode("view");
      setStatus(
        action === "move" ? "Din aftale er flyttet." : "Din aftale er aflyst.",
      );
    } catch (e) {
      if (action === "move") await openMove();
      setError((e as Error).message);
      setRevision((n) => n + 1);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function calendar() {
    try {
      const response = await fetch("/api/guest/calendar.ics", {
        headers: { "X-Aftale": token || "" },
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = "min-salonaftale.ics";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 3000);
    } catch {
      setError("Kalenderfilen kunne ikke hentes. Prøv igen.");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Dit private link er kopieret.");
    } catch {
      setStatus("Kopiér hele adressen i browserens adresselinje.");
    }
  }
  return (
    <main className="receipt-page">
      <header className="booking-top">
        <span className="wordmark">
          MAGS <span>Booking</span>
        </span>
      </header>
      <article className="receipt">
        <h1>
          {!item
            ? "Din aftale"
            : item.status === "cancelled"
              ? "Aftalen er aflyst"
              : mode === "move"
                ? "Flyt din aftale"
                : mode === "cancel"
                  ? "Aflys din aftale?"
                  : "Din aftale er booket"}
        </h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
        {!item &&
          (error ? (
            <button
              className="quiet"
              onClick={() => {
                setError("");
                setRevision((n) => n + 1);
              }}
            >
              Hent aftalen igen
            </button>
          ) : (
            <p role="status">Henter aftalen …</p>
          ))}
        {item && (
          <>
            <h2>{item.salonName}</h2>
            <dl className="receipt-lines">
              {[
                ["Behandling", item.serviceName],
                [
                  "Tid",
                  longDate(item.start) +
                    " kl. " +
                    clock(item.start) +
                    "–" +
                    clock(item.end),
                ],
                ["Frisør", item.staffName],
                ["Pris", money(item.priceMinor)],
                ["Adresse", item.address],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {mode === "view" && item.status !== "cancelled" && (
              <>
                <p>
                  Gem dit private link, så du kan finde aftalen igen. Du kan
                  også lægge den i din kalender.
                </p>
                <div className="button-row">
                  <button className="primary" onClick={copy}>
                    Kopiér aftalelink
                  </button>
                  <button className="quiet" onClick={calendar}>
                    Gem i kalender
                  </button>
                </div>
                {item.canChange ? (
                  <>
                    <p className="fine">
                      Du kan ændre tiden indtil {longDate(item.changeDeadline)}{" "}
                      kl. {clock(item.changeDeadline)}.
                    </p>
                    <div className="button-row">
                      <button className="quiet" onClick={openMove}>
                        Flyt aftale
                      </button>
                      <button
                        className="back"
                        onClick={() => {
                          setStatus("");
                          setError("");
                          setMode("cancel");
                        }}
                      >
                        Aflys aftale
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Ring til salonen for at ændre aftalen.</p>
                )}
              </>
            )}
            {mode === "move" && (
              <>
                <h3>Ny tid</h3>
                {loading && !availability ? (
                  <p>Finder ledige tider …</p>
                ) : availability ? (
                  <Times
                    onDayChange={() => {
                      setSlot(undefined);
                      setStaff("");
                    }}
                    days={availability.days.filter((d) => d.slots.length)}
                    onSelect={(s) => {
                      setSlot(s);
                      setStaff(
                        s.staffIds.includes(item.staffId)
                          ? item.staffId
                          : s.staffIds[0],
                      );
                    }}
                  />
                ) : (
                  <button className="quiet" onClick={openMove}>
                    Hent tider igen
                  </button>
                )}
                {slot && (
                  <>
                    <p>
                      {longDate(slot.start)} kl. {clock(slot.start)}
                    </p>
                    <label className="field">
                      Frisør
                      <select
                        value={staff}
                        onChange={(e) => setStaff(e.target.value)}
                      >
                        {(availability?.staff || [])
                          .filter((s) => slot.staffIds.includes(s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="primary"
                      disabled={loading}
                      onClick={() => save("move")}
                    >
                      Bekræft ny tid
                    </button>
                  </>
                )}
              </>
            )}
            {mode === "cancel" && (
              <>
                <p>Ved aflysning bliver din tid ledig for andre kunder.</p>
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() => save("cancel")}
                >
                  Ja, aflys aftalen
                </button>
              </>
            )}
            {mode !== "view" && (
              <button
                className="back"
                disabled={loading}
                onClick={() => {
                  setMode("view");
                  setError("");
                }}
              >
                Behold aftalen
              </button>
            )}
            <p className="fine">
              Kontakt {item.salonName} på{" "}
              <a href={"tel:" + item.phone}>{item.phone}</a>.
            </p>
            {item.status === "cancelled" && (
              <a href={"/s/" + item.salonSlug}>Book en ny tid</a>
            )}
          </>
        )}
      </article>
    </main>
  );
}
