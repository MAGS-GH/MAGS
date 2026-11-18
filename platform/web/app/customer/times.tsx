import { useId, useState } from "react";
import {
  clock,
  dateFormat,
  longDate,
  type Day,
  type Slot,
} from "../../lib/booking";
export function Times({
  days,
  onSelect,
  onDayChange,
  initialDate,
}: {
  days: Day[];
  onSelect: (s: Slot) => void;
  onDayChange?: (date: string) => void;
  initialDate?: string;
}) {
  const [date, setDate] = useState(initialDate || days[0]?.date || "");
  const labelId = useId();
  const day = days.find((d) => d.date === date) ?? days[0];
  function changeDate(next: string) {
    if (next !== day?.date) {
      setDate(next);
      onDayChange?.(next);
    }
  }
  if (!day)
    return (
      <p className="notice">Der er ingen ledige tider i bookingperioden.</p>
    );
  return (
    <div>
      <div className="date-strip" aria-label="Ledige dage">
        {days
          .slice(
            Math.floor(days.indexOf(day) / 5) * 5,
            Math.floor(days.indexOf(day) / 5) * 5 + 5,
          )
          .map((d) => (
            <button
              type="button"
              key={d.date}
              aria-pressed={d.date === day.date}
              aria-label={longDate(d.date)}
              onClick={() => changeDate(d.date)}
            >
              <span>{dateFormat(d.date, { weekday: "short" })}</span>
              <b>{dateFormat(d.date, { day: "numeric" })}</b>
              <span>{dateFormat(d.date, { month: "short" })}</span>
            </button>
          ))}
      </div>
      <label className="field">
        <span id={labelId}>Dag</span>
        <select
          aria-labelledby={labelId}
          value={day.date}
          onChange={(e) => changeDate(e.target.value)}
        >
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {longDate(d.date)}
            </option>
          ))}
        </select>
      </label>
      <div className="slot-head">
        <h3>Ledige tider</h3>
        <span>{dateFormat(day.date, { day: "numeric", month: "short" })}</span>
      </div>
      <div className="slot-grid">
        {day.slots.map((s) => (
          <button type="button" key={s.start} onClick={() => onSelect(s)}>
            {clock(s.start)}
          </button>
        ))}
      </div>
    </div>
  );
}
