import { proxyBooking } from "../proxy";

export function POST(request: Request) {
  return proxyBooking(request, "reservations");
}
