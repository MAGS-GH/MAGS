export type Role = "owner" | "reception" | "staff";
export type State = "draft" | "published" | "paused";
export type Membership = {
  id: string;
  name: string;
  slug: string;
  status: State;
  role: Role;
  staffId: string | null;
};
export type Me = { sub: string; admin: boolean; salons: Membership[] };
export type Salon = {
  id: string;
  name: string;
  slug: string;
  status: State;
  address: string;
  phone: string;
  accent: string;
  logoUrl: string | null;
  coverUrl: string | null;
  slotMinutes: number;
  horizonDays: number;
  noticeHours: number;
  changeHours: number;
};
export type Service = {
  id: string;
  name: string;
  description: string;
  photoUrl: string | null;
  priceOre: number;
  durationMinutes: number;
  cleanupMinutes: number;
  active: boolean;
};
export type Shift = { weekday: number; startMin: number; endMin: number };
export type Exception = { date: string; startMin: number | null; endMin: number | null };
export type Staff = {
  id: string;
  name: string;
  photoUrl: string | null;
  active: boolean;
  serviceIds: string[];
  shifts: Shift[];
  exceptions: Exception[];
};
export type Setup = {
  salon: Salon;
  staff: Staff[];
  services: Service[];
  members: { sub: string; name?: string; role: Role; staffId: string | null }[];
  invitations: { id: string; role: Role; staffId: string | null; expiresAt: string }[];
  readiness: { ready: boolean; missing: string[] };
};
export type Appointment = {
  id: string;
  staffId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  start: string;
  end: string;
  busyUntil: string;
  priceMinor: number;
  status: string;
};
export type Block = { id: string; staffId: string; start: string; end: string; reason: string };
export type Calendar = {
  date: string;
  staff: Pick<Staff, "id" | "name" | "photoUrl">[];
  appointments: Appointment[];
  blocks: Block[];
};
export type Slot = { start: string; end: string; staffIds: string[] };
export type Customer = { id: string; name: string; phone: string };
export type History = Customer & {
  appointments: {
    id: string;
    serviceName: string;
    staffName: string;
    start: string;
    end: string;
    status: string;
    priceMinor: number;
  }[];
};
export const labels = {
  draft: "Kladde",
  published: "Åben",
  paused: "Pauseret",
  owner: "Ejer",
  reception: "Reception",
  staff: "Frisør",
};
const zone = "Europe/Copenhagen";
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("da-DK", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("da-DK", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: zone,
});
const danishMoney = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
export const localDate = (v = new Date()) => dateFormat.format(v);
export const timeText = (value: string) => timeFormat.format(new Date(value));
export const dateText = (date: string) => longDate.format(new Date(date.slice(0, 10) + "T12:00:00Z"));
export const money = (ore: number) => danishMoney.format(ore / 100);
export const clock = (minutes: number) =>
  String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
export const toMinutes = (clock: string) => {
  const [h, m] = clock.split(/[:.]/).map(Number);
  return h * 60 + m;
};
export const shiftDate = (date: string, days: number) => {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export function instant(date: string, time: string) {
  const expected = Date.parse(date + "T" + time + ":00Z");
  // At the autumn transition the earliest matching occurrence owns the wall time.
  for (const offset of [120, 60]) {
    const value = new Date(expected - offset * 60000);
    if (localDate(value) === date && timeText(value.toISOString()).replace(".", ":") === time)
      return value.toISOString();
  }
  throw new Error("Tidspunktet findes ikke i dansk tid på denne dato. Vælg et andet klokkeslæt.");
}
