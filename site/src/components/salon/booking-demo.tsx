"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatSalonTime, salonAvailability, salonDays, stylists, treatments,
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
  const slots = useMemo(() => salonAvailability(day, treatment, stylistId), [day, treatment, stylistId]);
  const slot = slots.find(({ start }) => start === slotStart);

  useEffect(() => {
    onSceneChange({
      day, treatment, stylistId, confirmed,
      slot: slot ? { start: slot.start, end: slot.end, stylistId: slot.stylist.id } : null,
    });
  }, [onSceneChange, day, treatment, stylistId, confirmed, slot]);

  function selectTreatment(treatment: TreatmentId) {
    setSelection((previous) => {
      if (previous.treatment === treatment) return previous;
      const stylist = stylists.find(({ id }) => id === previous.stylistId);
      const stylistId = stylist?.treatments.includes(treatment) ? stylist.id : null;
      return { ...previous, treatment, stylistId, slotStart: null, confirmed: false };
    });
  }

  function selectStylist(stylistId: StylistId | null) {
    setSelection((previous) => previous.stylistId === stylistId ? previous : {
      ...previous, stylistId, slotStart: null, confirmed: false,
    });
  }

  function selectDay(day: SalonDay) {
    setSelection((previous) => previous.day === day ? previous : {
      ...previous, day, slotStart: null, confirmed: false,
    });
  }

  function selectSlot(slotStart: number) {
    setSelection((previous) => previous.slotStart === slotStart ? previous : {
      ...previous, slotStart, confirmed: false,
    });
  }

  function confirm() {
    if (slot) setSelection((previous) => ({ ...previous, confirmed: true }));
  }

  return {
    ...selection, slots, slot, selectTreatment, selectStylist, selectDay, selectSlot, confirm,
    reset: () => setSelection(initialSelection),
  };
}

type Chapter = "behandling" | "frisoer" | "tid" | "bekraeftelse";

export function SalonBookingStep({ chapter, booking }: { chapter: Chapter; booking: ReturnType<typeof useSalonBooking> }) {
  const treatment = treatments[booking.treatment];
  const { slot } = booking;

  if (chapter === "behandling") {
    return (
      <div className="salon-booking">
        <fieldset className="salon-options">
          <legend className="sr-only">Behandling</legend>
          <div className="salon-option-grid">
            {(Object.keys(treatments) as TreatmentId[]).map((id) => (
              <button className="salon-option" type="button" key={id} aria-pressed={booking.treatment === id} onClick={() => booking.selectTreatment(id)}>
                <span className="salon-option-name">{treatments[id].name}</span>
                <span className="salon-option-detail">{treatments[id].minutes} min.</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="salon-booking-actions"><a className="text-link" href="#frisoer">Vælg frisør <span aria-hidden="true">↓</span></a></div>
      </div>
    );
  }

  if (chapter === "frisoer") {
    return (
      <div className="salon-booking">
        <fieldset className="salon-options">
          <legend className="sr-only">Frisør</legend>
          <div className="salon-option-grid">
            <button className="salon-option" type="button" aria-pressed={booking.stylistId === null} onClick={() => booking.selectStylist(null)}>
              <span className="salon-option-name">Første ledige</span>
              <span className="salon-option-detail">Alle relevante frisører</span>
            </button>
            {stylists.filter((stylist) => stylist.treatments.includes(booking.treatment)).map((stylist) => (
              <button
                className="salon-option" type="button" key={stylist.id}
                aria-pressed={booking.stylistId === stylist.id}
                onClick={() => booking.selectStylist(stylist.id)}
              >
                <span className="salon-option-name">{stylist.name}</span>
                <span className="salon-option-detail">{stylist.treatments.length > 1 ? "Klip og farve" : "Klip"}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="salon-booking-actions"><a className="text-link" href="#tid">Se ledige tider <span aria-hidden="true">↓</span></a></div>
      </div>
    );
  }

  if (chapter === "tid") {
    const scrollTimes = booking.slots.length > 4;

    return (
      <div className="salon-booking">
        <fieldset className="salon-options">
          <legend className="sr-only">Dag</legend>
          <div className="salon-option-grid salon-days">
            {(Object.keys(salonDays) as SalonDay[]).map((day) => (
              <button className="salon-option" type="button" key={day} aria-pressed={booking.day === day} onClick={() => booking.selectDay(day)}>
                {salonDays[day]}
              </button>
            ))}
          </div>
        </fieldset>
        {booking.slots.length > 0 ? (
          <fieldset className="salon-options">
            <legend className="sr-only">Ledige tider</legend>
            <div
              className="salon-option-grid salon-times"
              role={scrollTimes ? "region" : undefined}
              aria-label={scrollTimes ? "Rul gennem ledige tider" : undefined}
              tabIndex={scrollTimes ? 0 : undefined}
            >
              {booking.slots.map(({ start, stylist }) => (
                <button className="salon-option" type="button" key={start} aria-pressed={booking.slotStart === start} onClick={() => booking.selectSlot(start)}>
                  <span className="salon-option-name">{formatSalonTime(start)}</span>
                  <span className="salon-option-detail">{stylist.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="salon-booking-note" role="status">Ingen ledige tider. Prøv en anden dag eller frisør.</p>
        )}
        {slot && (
          <div className="salon-booking-actions"><a className="text-link" href="#bekraeftelse">Gå til bekræftelse <span aria-hidden="true">↓</span></a></div>
        )}
      </div>
    );
  }

  if (!slot) {
    return (
      <div className="salon-booking">
        <div className="salon-booking-actions">
          <button className="primary-action" type="button" disabled>Bekræft demoaftalen</button>
          <a className="text-link" href="#tid">Vælg en tid <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    );
  }

  const timeRange = `${formatSalonTime(slot.start)}–${formatSalonTime(slot.end)}`;
  const calendarOwner = slot.stylist.name.endsWith("s") ? `${slot.stylist.name}'` : `${slot.stylist.name}s`;

  return (
    <div className="salon-booking">
      <div className="salon-booking-summary">
        {booking.confirmed && <p className="salon-booking-note">{calendarOwner} kalender</p>}
        <p><strong>{treatment.name} hos {slot.stylist.name}</strong></p>
        <p>{salonDays[booking.day]} kl. {timeRange} · {treatment.minutes} min.</p>
      </div>
      <p className="salon-booking-note" role="status">{booking.confirmed && `Demoaftalen er lagt i ${calendarOwner} kalender.`}</p>
      <div className="salon-booking-actions">
        {booking.confirmed ? (
          <a className="text-link" href="#behandling" onClick={booking.reset}>Prøv igen <span aria-hidden="true">↑</span></a>
        ) : (
          <button className="primary-action" type="button" onClick={booking.confirm}>Bekræft demoaftalen</button>
        )}
      </div>
    </div>
  );
}
