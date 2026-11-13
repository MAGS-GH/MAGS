import type { SalonDay, StylistId, TreatmentId } from "./availability";

export type SalonDisplayState = {
  treatment: TreatmentId;
  stylistId: StylistId | null;
  day: SalonDay;
  slot: { start: number; end: number; stylistId: StylistId } | null;
  confirmed: boolean;
};

export const initialSalonDisplay: SalonDisplayState = {
  treatment: "klipning", stylistId: null, day: "tirsdag", slot: null, confirmed: false,
};
