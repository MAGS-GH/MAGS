"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError, mutate } from "../auth/client";
import { Feedback, Load, useAction, useResource } from "./common";
import {
  clock,
  instant,
  localDate,
  timeText,
  toMinutes,
  type Appointment,
  type Customer,
  type Setup,
  type Slot,
} from "./types";

export type Editing = {
  kind: "book" | "move" | "block";
  date: string;
  staffId?: string;
  time?: string;
  appointment?: Appointment;
  customer?: Customer;
};
interface Props {
  editor: Editing;
  setup: Setup;
  base: string;
  staffIds: string[];
  close: () => void;
  done: (s: string) => void;
}

function BlockForm({ editor, setup, base, staffIds, close, done }: Props) {
  const action = useAction();
  const [conflicts, setConflicts] = useState<NonNullable<ApiError["affected"]>>([]);
  return (
    <form
      className="wk-panel wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        action.run(async () => {
          setConflicts([]);
          try {
            await mutate(base + "/blocks", "POST", {
              staffId: d.get("staff"),
              start: instant(String(d.get("date")), String(d.get("start"))),
              end: instant(String(d.get("date")), String(d.get("end"))),
              reason: d.get("reason"),
            });
          } catch (error) {
            if (error instanceof ApiError && error.affected) setConflicts(error.affected);
            throw error;
          }
          done("Tiden er blokeret.");
        });
      }}
    >
      <div className="wk-spread">
        <h2>Blokér tid</h2>
        <button type="button" onClick={close}>
          Luk
        </button>
      </div>
      <div className="wk-form-grid">
        <label>
          Frisør
          <select aria-label="Frisør" required name="staff" defaultValue={editor.staffId}>
            {setup.staff
              .filter((s) => staffIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Dato
          <input name="date" type="date" required defaultValue={editor.date} />
        </label>
        <label>
          Fra
          <input type="time" name="start" required defaultValue={editor.time ?? "12:00"} />
        </label>
        <label>
          Til
          <input
            type="time"
            name="end"
            required
            defaultValue={clock(Math.min(1439, toMinutes(editor.time ?? "12:00") + 30))}
          />
        </label>
      </div>
      <label>
        Vis som
        <input name="reason" maxLength={150} placeholder="Fx frokost eller personalemøde" required />
      </label>
      <Feedback error={action.error} />
      {conflicts.length > 0 && (
        <ul>
          {conflicts.map((item) => (
            <li key={item.id}>
              <Link
                href={
                  "/salon?id=" +
                  setup.salon.id +
                  "&date=" +
                  localDate(new Date(item.startsAt)) +
                  "&appointment=" +
                  item.id
                }
              >
                {item.customerName} kl. {timeText(item.startsAt)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button disabled={action.pending} className="wk-primary">
        Blokér tid
      </button>
    </form>
  );
}

export function AppointmentEditor(props: Props) {
  return props.editor.kind === "block" ? <BlockForm {...props} /> : <BookingForm {...props} />;
}

function BookingForm({ editor, setup, base, staffIds, close, done }: Props) {
  const a = editor.appointment;
  const move = editor.kind === "move";
  const action = useAction();
  const [revision, setRevision] = useState(0);
  const [service, setService] = useState(a?.serviceId ?? "");
  const [date, setDate] = useState(editor.date);
  const [staff, setStaff] = useState(editor.staffId ?? a?.staffId ?? "");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState(editor.customer?.name ?? a?.customerName ?? "");
  const [phone, setPhone] = useState(editor.customer?.phone ?? a?.customerPhone ?? "");
  const [showCustomers, setShowCustomers] = useState(false);
  const [q, setQ] = useState("");
  const lastRequest = useRef<{ key: string; id: string } | null>(null);
  const customers = useResource<{ customers: Customer[] }>(
    showCustomers && q.trim().length > 1 ? base + "/customers?q=" + encodeURIComponent(q.trim()) : null,
  );
  const availability = useResource<{ days: { date: string; slots: Slot[] }[] }>(
    service && date
      ? base +
          "/availability?serviceId=" +
          service +
          "&from=" +
          date +
          "&days=1" +
          (move ? "&appointmentId=" + a!.id : "")
      : null,
    revision,
  );
  const choices = (availability.value?.days[0]?.slots ?? []).filter((v) =>
    v.staffIds.some((id) => staffIds.includes(id) && (!staff || staff === id)),
  );
  const selected =
    choices.find((v) => v.start === slot) ??
    (!slot && editor.time && editor.date === date
      ? choices.find((v) => timeText(v.start).replace(".", ":") === editor.time)
      : undefined);
  const services = setup.services.filter((s) => s.active || s.id === a?.serviceId);
  return (
    <form
      className="wk-panel wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        action.run(async () => {
          try {
            if (move)
              await mutate(base + "/appointments/" + a!.id + "/move", "POST", {
                start: selected.start,
                staffId: staff || undefined,
              });
            else {
              const draft = {
                serviceId: service,
                staffId: staff || undefined,
                start: selected.start,
                name,
                phone,
              };
              const key = JSON.stringify(draft);
              if (lastRequest.current?.key !== key) lastRequest.current = { key, id: crypto.randomUUID() };
              await mutate(base + "/appointments", "POST", { ...draft, requestId: lastRequest.current.id });
            }
            done(move ? "Aftalen er flyttet." : "Telefonbookingen er oprettet.");
          } catch (e) {
            setRevision((v) => v + 1);
            throw e;
          }
        });
      }}
    >
      <div className="wk-spread">
        <h2>{move ? "Flyt aftale" : "Telefonbooking"}</h2>
        <button type="button" onClick={close}>
          Luk
        </button>
      </div>
      {move && a && (
        <p>
          {a.customerName} har {a.serviceName.toLocaleLowerCase("da")} den {localDate(new Date(a.start))} kl.{" "}
          {timeText(a.start)}.
        </p>
      )}
      <div className="wk-form-grid">
        <label>
          Behandling
          <select
            aria-label="Behandling"
            required
            value={service}
            disabled={move}
            onChange={(e) => {
              setService(e.target.value);
              setSlot("");
            }}
          >
            <option value="" disabled>
              Vælg behandling
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dato
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot("");
            }}
          />
        </label>
        <label>
          Frisør
          <select
            aria-label="Frisør"
            value={staff}
            onChange={(e) => {
              setStaff(e.target.value);
              setSlot("");
            }}
          >
            <option value="">Ingen præference</option>
            {setup.staff
              .filter((s) => staffIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ledig tid
          <select
            aria-label="Ledig tid"
            required
            value={selected?.start ?? ""}
            onChange={(e) => setSlot(e.target.value)}
            disabled={!choices.length}
          >
            <option value="">
              {!service
                ? "Vælg en behandling først"
                : !availability.value
                  ? "Henter tider …"
                  : !choices.length
                    ? "Ingen ledige tider"
                    : "Vælg tidspunkt"}
            </option>
            {choices.map((v) => (
              <option key={v.start} value={v.start}>
                {timeText(v.start)} – {timeText(v.end)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {availability.error && <Load error={availability.error} retry={() => setRevision(revision + 1)} />}
      {service && availability.value && !choices.length && <p>Prøv en anden dag eller frisør.</p>}
      {!move && (
        <>
          <div className="wk-spread">
            <h3>Kunde</h3>
            <button type="button" onClick={() => setShowCustomers(!showCustomers)}>
              {showCustomers ? "Luk kundesøgning" : "Find i kundekartotek"}
            </button>
          </div>
          {showCustomers && (
            <div>
              <label>
                Søg efter navn eller telefon
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mindst to tegn" />
              </label>
              {customers.error && <Feedback error={customers.error.message} />}
              {customers.value &&
                (!customers.value.customers.length ? (
                  <p>Ingen kunder fundet.</p>
                ) : (
                  <ul className="wk-options">
                    {customers.value.customers.slice(0, 15).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setName(c.name);
                            setPhone(c.phone);
                            setShowCustomers(false);
                          }}
                        >
                          {c.name} ({c.phone})
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          )}
          <div className="wk-form-grid">
            <label>
              Kundens navn
              <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Telefonnummer
              <input
                required
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
        </>
      )}
      <Feedback error={action.error} />
      <button className="wk-primary" disabled={action.pending || !selected}>
        {move ? "Gem flytning" : "Book aftale"}
      </button>
    </form>
  );
}
