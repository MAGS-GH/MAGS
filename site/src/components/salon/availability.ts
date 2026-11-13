export const treatments = {
  klipning: { name: "Klipning", minutes: 45 },
  farve: { name: "Farve", minutes: 120 },
} as const;

export type TreatmentId = keyof typeof treatments;
export type StylistId = "freja" | "noor" | "elias";
export type SalonDay = "tirsdag" | "onsdag";

export const salonDays = { tirsdag: "Tirsdag", onsdag: "Onsdag" } as const;

type Interval = readonly [start: number, end: number];
type Workday = { shift: Interval; busy: readonly Interval[] };
type Stylist = {
  id: StylistId;
  name: string;
  station: number;
  treatments: readonly TreatmentId[];
  calendar: Record<SalonDay, Workday>;
};

const dayShift: Interval = [9 * 60, 16 * 60];

export const stylists: readonly Stylist[] = [
  {
    id: "freja", name: "Freja", station: 0, treatments: ["klipning", "farve"],
    calendar: {
      tirsdag: { shift: dayShift, busy: [[870, 900]] },
      onsdag: { shift: dayShift, busy: [] },
    },
  },
  {
    id: "noor", name: "Noor", station: 1, treatments: ["klipning", "farve"],
    calendar: {
      tirsdag: { shift: dayShift, busy: [[900, 930]] },
      onsdag: { shift: dayShift, busy: [[870, 900]] },
    },
  },
  {
    id: "elias", name: "Elias", station: 2, treatments: ["klipning", "farve"],
    calendar: {
      tirsdag: { shift: dayShift, busy: [] },
      onsdag: { shift: dayShift, busy: [[900, 930]] },
    },
  },
];

export type SalonTime = { start: number; end: number; stylists: Stylist[] };

export function salonTimeOptions(day: SalonDay, treatment: TreatmentId) {
  const duration = treatments[treatment].minutes;
  const times = new Map<number, SalonTime>();

  for (const stylist of stylists) {
    if (!stylist.treatments.includes(treatment)) continue;

    const { shift: [opens, closes], busy } = stylist.calendar[day];
    // The entire service must fit before the next appointment or the end of the shift.
    for (let start = Math.ceil(opens / 30) * 30; start + duration <= closes; start += 30) {
      const end = start + duration;
      if (busy.some(([busyStart, busyEnd]) => start < busyEnd && end > busyStart)) continue;
      const time = times.get(start);
      if (time) time.stylists.push(stylist);
      else times.set(start, { start, end, stylists: [stylist] });
    }
  }

  return [...times.values()].sort((first, second) => first.start - second.start);
}

export function salonCalendar(treatment: TreatmentId) {
  return {
    tirsdag: salonTimeOptions("tirsdag", treatment),
    onsdag: salonTimeOptions("onsdag", treatment),
  };
}

export function formatSalonTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}.${String(remainder).padStart(2, "0")}`;
}
