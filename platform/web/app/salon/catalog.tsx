"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, ApiError, mutate } from "../auth/client";
import { Feedback, useAction } from "./common";
import {
  clock,
  money,
  toMinutes,
  localDate,
  timeText,
  type Setup,
  type Service,
  type Staff,
  type Shift,
  type Exception,
} from "./types";

export function Upload({
  value,
  onChange,
  base,
  label,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  base: string;
  label: string;
}) {
  const action = useAction();
  return (
    <div className="wk-upload">
      <label>
        {label}
        {value && <Image src={value} alt="" width={60} height={60} unoptimized />}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={action.pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            action.run(async () => {
              const result = await api<{ url: string }>(base + "/media", {
                method: "POST",
                body: file,
                headers: { "Content-Type": file.type },
              });
              onChange(result.url);
            });
          }}
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange(null)}>
          Fjern billede
        </button>
      )}
      <Feedback error={action.error} status={action.pending ? "Uploader billede …" : ""} />
    </div>
  );
}

type EditorProps = { base: string; setup: Setup; done: (message: string) => void };
const names = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function ServiceForm({
  base,
  item,
  close,
  done,
}: {
  base: string;
  item: Partial<Service>;
  close: () => void;
  done: (s: string) => void;
}) {
  const action = useAction();
  const [photo, setPhoto] = useState(item.photoUrl ?? null);
  return (
    <form
      className="wk-panel wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        action.run(async () => {
          await mutate(base + "/services" + (item.id ? "/" + item.id : ""), item.id ? "PUT" : "POST", {
            name: d.get("name"),
            description: d.get("description"),
            priceOre: Math.round(Number(d.get("price")) * 100),
            durationMinutes: Number(d.get("minutes")),
            cleanupMinutes: Number(d.get("cleanup")),
            active: d.has("active"),
            photoUrl: photo,
          });
          close();
          done("Behandlingen er gemt.");
        });
      }}
    >
      <div className="wk-spread">
        <h3>{item.id ? "Redigér behandling" : "Ny behandling"}</h3>
        <button type="button" onClick={close}>
          Luk
        </button>
      </div>
      <label>
        Navn
        <input name="name" required maxLength={120} defaultValue={item.name} />
      </label>
      <label>
        Beskrivelse
        <textarea name="description" maxLength={1200} defaultValue={item.description} />
      </label>
      <div className="wk-form-grid">
        <label>
          Pris i kroner
          <input
            name="price"
            type="number"
            required
            min={0}
            step="0.01"
            defaultValue={(item.priceOre ?? 0) / 100}
          />
        </label>
        <label>
          Behandling i minutter
          <input
            name="minutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={item.durationMinutes ?? 45}
            required
          />
        </label>
        <label>
          Oprydning i minutter
          <input
            name="cleanup"
            type="number"
            required
            min={0}
            max={1439}
            defaultValue={item.cleanupMinutes ?? 0}
          />
        </label>
      </div>
      <Upload label="Behandlingsbillede" value={photo} onChange={setPhoto} base={base} />
      <label className="wk-check">
        <input type="checkbox" name="active" defaultChecked={item.active ?? true} /> Tilbyd behandlingen
      </label>
      <Feedback error={action.error} />
      <button disabled={action.pending} className="wk-primary">
        Gem behandling
      </button>
    </form>
  );
}

export function Services({ base, setup, done }: EditorProps) {
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  return (
    <section>
      <div className="wk-title">
        <div>
          <h1>Behandlinger</h1>
          <p>Priser og varighed på salonens bookingside.</p>
        </div>
        <button className="wk-primary" onClick={() => setEdit({})}>
          Ny behandling
        </button>
      </div>
      {edit && (
        <ServiceForm key={edit.id ?? "new"} item={edit} base={base} close={() => setEdit(null)} done={done} />
      )}
      {!setup.services.length ? (
        <div className="wk-empty">Opret den første behandling, og tilknyt en frisør under Personale.</div>
      ) : (
        <div className="wk-list">
          {setup.services.map((s) => (
            <article key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.durationMinutes} min.
                  {s.cleanupMinutes > 0 ? " + " + s.cleanupMinutes + " min. oprydning" : ""}
                </small>
              </div>
              <b>{money(s.priceOre)}</b>
              <span className="wk-status">{s.active ? "Aktiv" : "Skjult"}</span>
              <button onClick={() => setEdit(s)}>
                Redigér<span className="wk-sr"> {s.name}</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ShiftEditor({ shifts, setShifts }: { shifts: Shift[]; setShifts: (s: Shift[]) => void }) {
  const replace = (i: number, patch: Partial<Shift>) =>
    setShifts(shifts.map((item, j) => (i === j ? { ...item, ...patch } : item)));
  return (
    <fieldset>
      <legend>Fast ugeplan</legend>
      {shifts.map((s, i) => (
        <div className="wk-schedule" key={i}>
          <label>
            Dag
            <select
              aria-label="Dag"
              value={s.weekday}
              onChange={(e) => replace(i, { weekday: Number(e.target.value) })}
            >
              {names.map((n, j) => (
                <option key={n} value={j + 1}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fra
            <input
              type="time"
              required
              value={clock(s.startMin)}
              onChange={(e) => e.target.value && replace(i, { startMin: toMinutes(e.target.value) })}
            />
          </label>
          <label>
            Til
            <input
              type="time"
              required
              value={clock(s.endMin)}
              onChange={(e) => e.target.value && replace(i, { endMin: toMinutes(e.target.value) })}
            />
          </label>
          <button
            type="button"
            aria-label={"Fjern vagt " + names[s.weekday - 1]}
            onClick={() => setShifts(shifts.filter((_, j) => j !== i))}
          >
            Fjern
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setShifts([
            ...shifts,
            { weekday: Math.min(7, (shifts.at(-1)?.weekday ?? 0) + 1), startMin: 540, endMin: 1020 },
          ])
        }
      >
        Tilføj vagt
      </button>
    </fieldset>
  );
}

function Exceptions({ items, change }: { items: Exception[]; change: (v: Exception[]) => void }) {
  const modify = (i: number, patch: Partial<Exception>) =>
    change(items.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <fieldset>
      <legend>Ferie og særlige arbejdsdage</legend>
      {items.map((item, i) => (
        <div className="wk-schedule" key={i}>
          <label>
            Dato
            <input
              type="date"
              value={item.date}
              required
              onChange={(e) => modify(i, { date: e.target.value })}
            />
          </label>
          <label>
            Arbejdstid
            <select
              value={item.startMin == null ? "off" : "work"}
              onChange={(e) =>
                modify(
                  i,
                  e.target.value === "off"
                    ? { startMin: null, endMin: null }
                    : { startMin: 540, endMin: 1020 },
                )
              }
            >
              <option value="off">Fridag</option>
              <option value="work">Ændret vagt</option>
            </select>
          </label>
          {item.startMin != null && (
            <>
              <label>
                Fra
                <input
                  type="time"
                  required
                  value={clock(item.startMin)}
                  onChange={(e) => e.target.value && modify(i, { startMin: toMinutes(e.target.value) })}
                />
              </label>
              <label>
                Til
                <input
                  type="time"
                  required
                  value={clock(item.endMin ?? 1020)}
                  onChange={(e) => e.target.value && modify(i, { endMin: toMinutes(e.target.value) })}
                />
              </label>
            </>
          )}
          <button type="button" onClick={() => change(items.filter((_, j) => j !== i))}>
            Fjern
          </button>
        </div>
      ))}
      <button type="button" onClick={() => change([...items, { date: "", startMin: null, endMin: null }])}>
        Tilføj dato
      </button>
    </fieldset>
  );
}

function StaffForm({
  base,
  setup,
  item,
  close,
  done,
}: EditorProps & { item: Partial<Staff>; close: () => void }) {
  const action = useAction();
  const [photo, setPhoto] = useState(item.photoUrl ?? null);
  const [shifts, setShifts] = useState<Shift[]>(item.shifts ?? []);
  const [exceptions, setExceptions] = useState<Exception[]>(item.exceptions ?? []);
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
            await mutate(base + "/staff" + (item.id ? "/" + item.id : ""), item.id ? "PUT" : "POST", {
              name: d.get("name"),
              active: d.has("active"),
              serviceIds: d.getAll("service"),
              photoUrl: photo,
              shifts,
              exceptions,
            });
          } catch (error) {
            if (error instanceof ApiError && error.affected) setConflicts(error.affected);
            throw error;
          }
          close();
          done("Medarbejder og arbejdstider er gemt.");
        });
      }}
    >
      <div className="wk-spread">
        <h3>{item.id ? "Redigér medarbejder" : "Ny medarbejder"}</h3>
        <button type="button" onClick={close}>
          Luk
        </button>
      </div>
      <label>
        Navn
        <input name="name" defaultValue={item.name} maxLength={120} required />
      </label>
      <Upload label="Portræt" base={base} value={photo} onChange={setPhoto} />
      <fieldset>
        <legend>Behandlinger</legend>
        {!setup.services.length && <p>Opret behandlinger under Behandlinger for at tilknytte dem her.</p>}
        {setup.services.map((s) => (
          <label className="wk-check" key={s.id}>
            <input
              type="checkbox"
              name="service"
              value={s.id}
              defaultChecked={item.serviceIds?.includes(s.id)}
            />
            {s.name}
          </label>
        ))}
      </fieldset>
      <ShiftEditor shifts={shifts} setShifts={setShifts} />
      <Exceptions items={exceptions} change={setExceptions} />
      <label className="wk-check">
        <input name="active" type="checkbox" defaultChecked={item.active ?? true} /> Kan tage bookinger
      </label>
      <Feedback error={action.error} />
      {conflicts.length > 0 && (
        <ul>
          {conflicts.map((c) => (
            <li key={c.id}>
              <Link
                href={
                  "/salon?id=" +
                  setup.salon.id +
                  "&date=" +
                  localDate(new Date(c.startsAt)) +
                  "&appointment=" +
                  c.id
                }
              >
                {c.customerName} den{" "}
                {new Date(c.startsAt).toLocaleDateString("da-DK", { timeZone: "Europe/Copenhagen" })} kl.{" "}
                {timeText(c.startsAt)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button className="wk-primary" disabled={action.pending}>
        Gem medarbejder
      </button>
    </form>
  );
}

export function Team({ base, setup, done }: EditorProps) {
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  return (
    <section>
      <div className="wk-title">
        <div>
          <h1>Personale</h1>
          <p>Behandlinger og arbejdstider for hver frisør.</p>
        </div>
        <button className="wk-primary" onClick={() => setEdit({})}>
          Ny medarbejder
        </button>
      </div>
      {edit && (
        <StaffForm
          key={edit.id ?? "new"}
          {...{ base, setup, done }}
          item={edit}
          close={() => setEdit(null)}
        />
      )}
      {!setup.staff.length ? (
        <div className="wk-empty">Tilføj en medarbejder for at åbne den første kalender.</div>
      ) : (
        <div className="wk-list">
          {setup.staff.map((s) => (
            <article key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {setup.services
                    .filter((v) => s.serviceIds.includes(v.id))
                    .map((v) => v.name)
                    .join(", ") || "Ingen behandlinger valgt"}
                </small>
              </div>
              <span className="wk-status">{s.active ? "Aktiv" : "Inaktiv"}</span>
              <button onClick={() => setEdit(s)}>
                Redigér<span className="wk-sr"> {s.name}</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
