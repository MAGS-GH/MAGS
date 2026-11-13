import { proxyBooking } from "../proxy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return proxyBooking(request, "availability");
}
