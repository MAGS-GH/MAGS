"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "../auth/client";
import { Feedback, Load, useAction, useResource } from "./common";
import { AppointmentEditor, type Editing } from "./appointment-editor";
import {
  clock,
  dateText,
  localDate,
  money,
  shiftDate,
  timeText,
  toMinutes,
  type Appointment,
  type Block,
  type Calendar,
  type Customer,
  type Setup,
  type Staff,
} from "./types";

function workHours(staff: Staff | undefined, date: string) {
  const exception = staff?.exceptions?.filter((e) => e.date === date);
  if (exception?.length)
    return exception.flatMap((e) =>
      e.startMin != null && e.endMin != null ? [{ startMin: e.startMin, endMin: e.endMin }] : [],
    );
  const weekday = new Date(date + "T12:00:00Z").getUTCDay() || 7;
  return staff?.shifts.filter((s) => s.weekday === weekday) ?? [];
}

const minute = (stamp: string) => toMinutes(timeText(stamp));
type EventItem = {
  id: string;
  staffId: string;
  start: string;
  end: string;
  title: string;
  subtitle: string;
  block: boolean;
};

function DayGrid({
  data,
  setup,
  items,
  onClick,
  onCreate,
}: {
  data: Calendar;
  setup: Setup;
  items: EventItem[];
  onClick: (i: EventItem) => void;
  onCreate: (staffId: string, time: string) => void;
}) {
  const hours = data.staff.map((s) =>
    workHours(
      setup.staff.find((p) => p.id === s.id),
      data.date,
    ),
  );
  const bounds = new Map<string, number>();
  const dayMinute = (stamp: string) => {
    const cached = bounds.get(stamp);
    if (cached !== undefined) return cached;
    const d = localDate(new Date(stamp));
    const m = d < data.date ? 0 : d > data.date ? 1440 : minute(stamp);
    bounds.set(stamp, m);
    return m;
  };
  const opens =
    Math.floor(
      Math.min(
        ...hours.flatMap((p) => p.map((s) => s.startMin)),
        ...items.map((i) => dayMinute(i.start)),
        9 * 60,
      ) / 60,
    ) * 60;
  const closes = Math.min(
    1440,
    Math.ceil(
      Math.max(
        ...hours.flatMap((p) => p.map((s) => s.endMin)),
        ...items.map((i) => dayMinute(i.end)),
        17 * 60,
      ) / 60,
    ) * 60,
  );
  const duration = closes - opens;
  const hoursShown = Array.from({ length: duration / 60 }, (_, i) => opens + i * 60);
  const pos = (t: number) => (100 * (t - opens)) / duration + "%";
  const height = (a: number, b: number) => (100 * (b - a)) / duration + "%";
  return (
    <div className="wk-grid-scroll">
      <div
        className="wk-calendar-grid"
        style={{ "--columns": data.staff.length, "--hours": duration / 60 } as CSSProperties}
      >
        <div className="wk-axis">
          <span className="wk-col-name">Tid</span>
          <div className="wk-track">
            {hoursShown.map((h) => (
              <time key={h} style={{ top: pos(h) }}>
                {clock(h)}
              </time>
            ))}
          </div>
        </div>
        {data.staff.map((s, i) => (
          <div key={s.id}>
            <span className="wk-col-name">{s.name}</span>
            <div className="wk-track">
              {hours[i].flatMap((h, idx) => {
                const step = setup.salon.slotMinutes;
                const start = Math.ceil(h.startMin / step) * step;
                return Array.from({ length: Math.ceil((h.endMin - start) / step) }, (_, j) => {
                  const m = start + j * step;
                  if (
                    items.some((v) => v.staffId === s.id && dayMinute(v.start) <= m && dayMinute(v.end) > m)
                  )
                    return null;
                  return (
                    <button
                      type="button"
                      className="wk-free"
                      key={idx + "-" + m}
                      style={{ top: pos(m), height: height(m, Math.min(h.endMin, m + step)) }}
                      aria-label={"Book " + s.name + " kl. " + clock(m)}
                      title={"Book kl. " + clock(m)}
                      onClick={() => onCreate(s.id, clock(m))}
                    >
                      <span>{clock(m)}</span>
                    </button>
                  );
                });
              })}
              {items
                .filter((v) => v.staffId === s.id)
                .map((v) => (
                  <button
                    type="button"
                    className={"wk-event" + (v.block ? " wk-block" : "")}
                    key={v.id}
                    onClick={() => onClick(v)}
                    style={{
                      top: pos(dayMinute(v.start)),
                      height: height(dayMinute(v.start), dayMinute(v.end)),
                    }}
                    title={timeText(v.start) + " " + v.title + " – " + v.subtitle}
                  >
                    <b>
                      {timeText(v.start)} {v.title}
                    </b>
                    <small>{v.subtitle}</small>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Diary({
  base,
  setup,
  date,
  customerId,
  appointmentId,
  staffId,
  owner,
  done,
}: {
  base: string;
  setup: Setup;
  date: string;
  customerId: string;
  appointmentId: string;
  staffId: string | null;
  owner: boolean;
  done: (s: string) => void;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<Editing | null>(null);
  const [selected, setSelected] = useState(appointmentId);
  const data = useResource<Calendar>(base + "/calendar?date=" + date, revision, true);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const customer = useResource<Customer>(
    customerId ? base + "/customers/" + encodeURIComponent(customerId) : null,
  );
  const [customerClosed, setCustomerClosed] = useState(false);
  const effectiveEdit =
    edit ??
    (!customerClosed && customer.value
      ? { kind: "book" as const, date, staffId: staffId ?? undefined, customer: customer.value }
      : null);
  const action = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const hasEditor = !!effectiveEdit;
  useEffect(() => {
    if (hasEditor || selected) formRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [hasEditor, selected]);
  const salonId = setup.salon.id;
  const path = "/salon?id=" + salonId + "&date=";
  const ap = data.value?.appointments.find((v) => v.id === selected);
  const block = data.value?.blocks.find((v) => v.id === selected);
  const ids = data.value?.staff.map((s) => s.id) ?? [];
  const complete = (text: string) => {
    setSelected("");
    setEdit(null);
    setCustomerClosed(true);
    setRevision((v) => v + 1);
    done(text);
  };
  const open = (value: Editing) => {
    setSelected("");
    setEdit(value);
    setCustomerClosed(true);
  };
  const choose = (id: string) => {
    setEdit(null);
    setCustomerClosed(true);
    setSelected(id);
    action.setError("");
  };
  const items: EventItem[] = [
    ...(data.value?.appointments ?? [])
      .filter((a) => !["cancelled", "canceled"].includes(a.status))
      .map((a) => ({
        id: a.id,
        staffId: a.staffId,
        start: a.start,
        end: a.busyUntil ?? a.end,
        title: a.customerName,
        subtitle: a.serviceName,
        block: false,
      })),
    ...(data.value?.blocks ?? []).map((b) => ({
      id: b.id,
      staffId: b.staffId,
      start: b.start,
      end: b.end,
      title: b.reason || "Blokeret",
      subtitle: "Blokeret tid",
      block: true,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <div className="wk-title">
        <div>
          <h1>Kalender</h1>
          <p className="wk-date">{dateText(date)}</p>
        </div>
        <div className="wk-actions">
          <button
            disabled={!ids.length}
            onClick={() => open({ kind: "block", date, staffId: staffId ?? undefined })}
          >
            Blokér tid
          </button>
          <button
            className="wk-primary"
            disabled={!ids.length}
            onClick={() => open({ kind: "book", date, staffId: staffId ?? undefined })}
          >
            Book tid
          </button>
        </div>
      </div>
      <div className="wk-toolbar">
        <div className="wk-actions">
          <Link href={path + shiftDate(date, -1)} aria-label="Forrige dag">
            ‹
          </Link>
          <label className="wk-date-input">
            <span className="wk-sr">Vælg dato</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && router.push(path + e.target.value, { scroll: false })}
            />
          </label>
          <Link href={path + shiftDate(date, 1)} aria-label="Næste dag">
            ›
          </Link>
          <Link href={path + localDate()}>I dag</Link>
        </div>
        <button onClick={() => setRevision((v) => v + 1)}>Opdatér kalender</button>
      </div>
      {customer.error && <Feedback error={customer.error.message} />}
      <div ref={formRef}>
        {effectiveEdit && (
          <AppointmentEditor
            key={[
              effectiveEdit.kind,
              effectiveEdit.date,
              effectiveEdit.time,
              effectiveEdit.staffId,
              ap?.id,
              effectiveEdit.customer?.id,
            ].join("-")}
            editor={effectiveEdit}
            setup={setup}
            base={base}
            staffIds={ids}
            close={() => {
              setEdit(null);
              setCustomerClosed(true);
            }}
            done={complete}
          />
        )}
        {(ap || block) && (
          <section className="wk-panel">
            <div className="wk-spread">
              <h2>{ap?.serviceName ?? block?.reason ?? "Blokeret tid"}</h2>
              <button onClick={() => setSelected("")}>Luk</button>
            </div>
            {ap && (
              <AppointmentInfo
                item={ap}
                staff={data.value!.staff.find((s) => s.id === ap.staffId)?.name ?? ""}
                salonId={salonId}
              />
            )}
            {block && (
              <BlockInfo
                item={block}
                staff={data.value!.staff.find((s) => s.id === block.staffId)?.name ?? ""}
              />
            )}
            <div className="wk-actions">
              {ap && (
                <button onClick={() => open({ kind: "move", appointment: ap, staffId: ap.staffId, date })}>
                  Flyt aftale
                </button>
              )}
              <button
                className="wk-danger"
                disabled={action.pending}
                onClick={() => {
                  if (
                    confirm(ap ? "Aflys denne aftale og frigiv tiden?" : "Fjern blokeringen og frigiv tiden?")
                  )
                    action.run(async () => {
                      if (ap) await mutate(base + "/appointments/" + ap.id + "/cancel", "POST");
                      else await mutate(base + "/blocks/" + block!.id, "DELETE");
                      complete(ap ? "Aftalen er aflyst." : "Blokeringen er fjernet.");
                    });
                }}
              >
                {ap ? "Aflys aftale" : "Fjern blokering"}
              </button>
            </div>
            <Feedback error={action.error} />
          </section>
        )}
      </div>
      {!data.value ? (
        <Load error={data.error} retry={() => setRevision(revision + 1)} />
      ) : !ids.length ? (
        <div className="wk-empty">
          <h2>Ingen medarbejderkalendere</h2>
          <p>
            {owner
              ? "Tilføj en medarbejder og angiv den første vagt."
              : "Kontakt salonejeren for at få tilknyttet en kalender."}
          </p>
          {owner && <Link href={"/salon?id=" + salonId + "&view=personale"}>Gå til personale</Link>}
        </div>
      ) : (
        <>
          <DayGrid
            data={data.value}
            setup={setup}
            items={items}
            onClick={(v) => choose(v.id)}
            onCreate={(id, time) => open({ kind: "book", date, staffId: id, time })}
          />
          <div className="wk-agenda">
            {!items.length ? (
              <div className="wk-empty">
                <h2>En åben dag</h2>
                <p>Der er ingen aftaler eller blokeringer på den valgte dag.</p>
              </div>
            ) : (
              items.map((v) => (
                <button
                  key={v.id}
                  className={"wk-agenda-item" + (v.block ? " wk-muted-event" : "")}
                  onClick={() => choose(v.id)}
                >
                  <time>{timeText(v.start)}</time>
                  <span>
                    <strong>{v.title}</strong>
                    <small>{v.subtitle}</small>
                  </span>
                  <span>{data.value!.staff.find((s) => s.id === v.staffId)?.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
function AppointmentInfo({ item: a, staff, salonId }: { item: Appointment; staff: string; salonId: string }) {
  return (
    <dl className="wk-info">
      <div>
        <dt>Kunde</dt>
        <dd>
          <Link href={"/salon?id=" + salonId + "&view=kunder&customer=" + a.customerId}>
            {a.customerName}
          </Link>
        </dd>
      </div>
      <div>
        <dt>Telefon</dt>
        <dd>
          <a href={"tel:" + a.customerPhone}>{a.customerPhone}</a>
        </dd>
      </div>
      <div>
        <dt>Frisør</dt>
        <dd>{staff}</dd>
      </div>
      <div>
        <dt>Tidspunkt</dt>
        <dd>
          {timeText(a.start)} – {timeText(a.end)}
        </dd>
      </div>
      <div>
        <dt>Pris</dt>
        <dd>{money(a.priceMinor)}</dd>
      </div>
      {a.busyUntil && a.busyUntil !== a.end && (
        <div>
          <dt>Oprydning til</dt>
          <dd>{timeText(a.busyUntil)}</dd>
        </div>
      )}
    </dl>
  );
}
function BlockInfo({ item, staff }: { item: Block; staff: string }) {
  return (
    <p>
      {staff} er optaget kl. {timeText(item.start)} – {timeText(item.end)}.
    </p>
  );
}
