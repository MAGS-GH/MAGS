export type Stylist = { id: string; name: string; photoUrl: string | null };
export type Service = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  durationMinutes: number;
  cleanupMinutes: number;
  photoUrl: string | null;
  firstAvailableDate: string | null;
};
export type Salon = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accent: string | null;
  changeHours: number;
  services: Service[];
  staff: Stylist[];
};
export type Slot = { start: string; end: string; staffIds: string[] };
export type Day = { date: string; slots: Slot[] };
export type Availability = { days: Day[]; staff?: Stylist[] };
export type Appointment = {
  id: string;
  salonSlug: string;
  salonName: string;
  address: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  staffName: string;
  staffId: string;
  customerName: string;
  start: string;
  end: string;
  priceMinor: number;
  status: string;
  changeDeadline: string;
  canChange: boolean;
};
export const dateFormat = (
  value: string,
  options: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    ...options,
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
export const longDate = (v: string) =>
  dateFormat(v, { weekday: "long", day: "numeric", month: "long" });
export const clock = (v: string) =>
  dateFormat(v, { hour: "2-digit", minute: "2-digit" });
export const money = (minor: number) =>
  new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: minor % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    throw new ApiError(503, "Forbindelsen blev afbrudt. Prøv igen.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error || "Handlingen kunne ikke gennemføres. Prøv igen.",
      data?.code,
    );
  return data as T;
}
export const jsonPost = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
