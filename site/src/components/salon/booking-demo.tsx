"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  formatSalonTime, salonCalendar, salonDays, treatments,
  type SalonDay, type StylistId, type TreatmentId,
} from "./availability";
import { initialSalonDisplay, type SalonDisplayState } from "./display-state";

type BookingSelection = Omit<SalonDisplayState, "slot"> & { slotStart: number | null };

const initialSelection: BookingSelection = {
  treatment: initialSalonDisplay.treatment,
  stylistId: initialSalonDisplay.stylistId,
  day: initialSalonDisplay.day,
  slotStart: null,
  confirmed: initialSalonDisplay.confirmed,
};

export function useSalonBooking(onSceneChange: (state: SalonDisplayState) => void) {
  const [selection, setSelection] = useState(initialSelection);
  const { day, treatment, stylistId, slotStart, confirmed } = selection;
  const calendar = useMemo(() => salonCalendar(treatment), [treatment]);
  const times = calendar[day];
  const time = times.find(({ start }) => start === slotStart);
  const stylist = time?.stylists.find(({ id }) => id === stylistId) ?? time?.stylists[0];

  useEffect(() => {
    onSceneChange({
      day, treatment, stylistId, confirmed,
      slot: time && stylist ? { start: time.start, end: time.end, stylistId: stylist.id } : null,
    });
  }, [onSceneChange, day, treatment, stylistId, confirmed, time, stylist]);

  function selectTreatment(treatment: TreatmentId) {
    setSelection((previous) => {
      if (previous.treatment === treatment) return previous;
      const nextCalendar = salonCalendar(treatment);
      const day = nextCalendar[previous.day].length ? previous.day
        : (Object.keys(salonDays) as SalonDay[]).find((candidate) => nextCalendar[candidate].length > 0) ?? previous.day;
      const time = day === previous.day ? nextCalendar[day].find(({ start }) => start === previous.slotStart) : undefined;
      const stylistId = time?.stylists.find(({ id }) => id === previous.stylistId)?.id ?? null;
      return { treatment, day, stylistId, slotStart: time?.start ?? null, confirmed: false };
    });
  }

  function selectStylist(stylistId: StylistId | null) {
    if (!time || (stylistId && !time.stylists.some(({ id }) => id === stylistId))) return;
    setSelection((previous) => previous.stylistId === stylistId ? previous : {
      ...previous, stylistId, confirmed: false,
    });
  }

  function selectDay(day: SalonDay) {
    if (calendar[day].length === 0) return;
    setSelection((previous) => previous.day === day ? previous : {
      ...previous, day, stylistId: null, slotStart: null, confirmed: false,
    });
  }

  function selectSlot(slotStart: number) {
    if (!times.some(({ start }) => start === slotStart)) return;
    setSelection((previous) => previous.slotStart === slotStart ? previous : {
      ...previous, slotStart, stylistId: null, confirmed: false,
    });
  }

  function confirm() {
    if (time && stylist) setSelection((previous) => ({ ...previous, confirmed: true }));
  }

  return {
    ...selection, calendar, times, time, stylist, selectTreatment, selectStylist, selectDay, selectSlot, confirm,
    reset: () => setSelection(initialSelection),
  };
}

type Chapter = "behandling" | "frisoer" | "tid" | "bekraeftelse";

function PhotoOption({ photo, name, detail, selected, onSelect }: {
  photo: TreatmentId | StylistId;
  name: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className="salon-option salon-photo-option" type="button" aria-pressed={selected} onClick={onSelect}>
      <span className="salon-option-photo">
        <Image src={`/salon/booking/${photo}.webp`} alt="" fill sizes="(max-width: 420px) 42vw, 190px" />
        {selected && <span className="salon-selection-mark" aria-hidden="true">✓</span>}
      </span>
      <span className="salon-option-label">
        <span className="salon-option-name">{name}</span>
        {detail && <span className="salon-option-detail">{detail}</span>}
      </span>
    </button>
  );
}

export function SalonBookingStep({ chapter, booking }: { chapter: Chapter; booking: ReturnType<typeof useSalonBooking> }) {
  const treatment = treatments[booking.treatment];
  const { time, stylist } = booking;

  if (chapter === "behandling") {
    return (
      <div className="salon-booking">
        <fieldset className="salon-options">
          <legend className="sr-only">Behandling</legend>
          <div className="salon-photo-grid salon-treatment-options">
            {(Object.keys(treatments) as TreatmentId[]).map((id) => (
              <PhotoOption key={id} photo={id} name={treatments[id].name} detail={`${treatments[id].minutes} min.`}
                selected={booking.treatment === id} onSelect={() => booking.selectTreatment(id)} />
            ))}
          </div>
        </fieldset>
        <div className="salon-booking-actions"><a className="primary-action" href="#tid">Se ledige tider <span aria-hidden="true">↓</span></a></div>
      </div>
    );
  }

  if (chapter === "frisoer") {
    if (!time || !stylist) {
      return (
        <div className="salon-booking">
          <p className="salon-booking-note">Vælg en tid for at se, hvem der kan tage din behandling.</p>
          <div className="salon-booking-actions"><a className="primary-action" href="#tid">Vælg en tid <span aria-hidden="true">↑</span></a></div>
        </div>
      );
    }
    const multiple = time.stylists.length > 1;

    return (
      <div className="salon-booking">
        <p className="salon-booking-note salon-chosen-time">{salonDays[booking.day]} kl. {formatSalonTime(time.start)} · {treatment.name}</p>
        <fieldset className="salon-options">
          <legend className="sr-only">Frisør</legend>
          {multiple && <button className="salon-option salon-auto-option" type="button" aria-pressed={booking.stylistId === null} onClick={() => booking.selectStylist(null)}>
            <span className="salon-option-label">
              <span className="salon-option-name">Ingen præference</span>
              <span className="salon-option-detail">{time.stylists[0].name} kan tage din tid</span>
            </span>
            {booking.stylistId === null && <span className="salon-selection-mark" aria-hidden="true">✓</span>}
          </button>}
          <div className="salon-photo-grid salon-stylist-options">
            {time.stylists.map(({ id, name }) => (
              <PhotoOption key={id} photo={id} name={name} detail={multiple ? undefined : "Tildelt automatisk"}
                selected={multiple ? booking.stylistId === id : true} onSelect={() => booking.selectStylist(multiple ? id : null)} />
            ))}
          </div>
        </fieldset>
        <div className="salon-booking-actions">
          <a className="primary-action" href="#bekraeftelse">Gå til bekræftelse <span aria-hidden="true">↓</span></a>
          <a className="text-link" href="#tid">Skift tid</a>
        </div>
      </div>
    );
  }

  if (chapter === "tid") {
    const scrollTimes = booking.times.length > 4;

    return (
      <div className="salon-booking">
        <fieldset className="salon-options">
          <legend className="sr-only">Dag</legend>
          <div className="salon-option-grid salon-days">
            {(Object.keys(salonDays) as SalonDay[]).map((day) => (
              <button className="salon-option" type="button" key={day} aria-pressed={booking.day === day}
                disabled={booking.calendar[day].length === 0} onClick={() => booking.selectDay(day)}>
                <span>{salonDays[day]}</span>
                {booking.calendar[day].length === 0 && <span className="salon-option-detail">Ingen tider</span>}
              </button>
            ))}
          </div>
        </fieldset>
        {booking.times.length > 0 ? (
          <fieldset className="salon-options">
            <legend className="sr-only">Ledige tider</legend>
            <div
              className="salon-option-grid salon-times"
              role={scrollTimes ? "region" : undefined}
              aria-label={scrollTimes ? "Rul gennem ledige tider" : undefined}
              tabIndex={scrollTimes ? 0 : undefined}
            >
              {booking.times.map(({ start, stylists }) => (
                <button className="salon-option" type="button" key={start} aria-pressed={booking.slotStart === start} onClick={() => booking.selectSlot(start)}>
                  <span className="salon-option-name">{formatSalonTime(start)}</span>
                  <span className="salon-option-detail">{stylists.length === 1 ? "1 ledig frisør" : `${stylists.length} ledige frisører`}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="salon-booking-actions">
            <p className="salon-booking-note" role="status">Der er ingen ledige tider til {treatment.name.toLowerCase()} i demokalenderen.</p>
            <a className="text-link" href="#behandling">Skift behandling</a>
          </div>
        )}
        {time && stylist && (
          <div className="salon-booking-actions">
            <a className="primary-action" href={time.stylists.length > 1 ? "#frisoer" : "#bekraeftelse"}>
              {time.stylists.length > 1 ? "Vælg frisør" : "Gå til bekræftelse"} <span aria-hidden="true">↓</span>
            </a>
            {time.stylists.length === 1 && <span className="salon-option-detail">{stylist.name} kan tage din tid.</span>}
          </div>
        )}
      </div>
    );
  }

  if (!time || !stylist) {
    return (
      <div className="salon-booking">
        <div className="salon-booking-actions">
          <button className="primary-action" type="button" disabled>Bekræft demoaftalen</button>
          <a className="text-link" href="#tid">Vælg en tid <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    );
  }

  const timeRange = `${formatSalonTime(time.start)}–${formatSalonTime(time.end)}`;
  const calendarOwner = stylist.name.endsWith("s") ? `${stylist.name}'` : `${stylist.name}s`;

  return (
    <div className="salon-booking">
      <div className="salon-booking-summary">
        {booking.confirmed && <p className="salon-booking-note">{calendarOwner} kalender</p>}
        <p><strong>{treatment.name} hos {stylist.name}</strong></p>
        <p>{salonDays[booking.day]} kl. {timeRange} · {treatment.minutes} min.</p>
      </div>
      <p className="salon-booking-note" role="status">{booking.confirmed && `Demoaftalen er lagt i ${calendarOwner} kalender.`}</p>
      <div className="salon-booking-actions">
        {booking.confirmed ? (
          <a className="text-link" href="#behandling" onClick={booking.reset}>Prøv igen <span aria-hidden="true">↑</span></a>
        ) : (
          <>
            <button className="primary-action" type="button" onClick={booking.confirm}>Bekræft demoaftalen</button>
            <a className="text-link" href="#tid">Skift tid</a>
            {time.stylists.length > 1 && <a className="text-link" href="#frisoer">Skift frisør</a>}
          </>
        )}
      </div>
    </div>
  );
}
