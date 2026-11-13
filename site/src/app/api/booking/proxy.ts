import { isIP } from "node:net";
import { readBookingConfig } from "./config";

const noStore = { "Cache-Control": "no-store" };
const maxBodyBytes = 8_192;

function errorResponse(code: string, status: number) {
  return Response.json({ code }, { status, headers: noStore });
}

async function readBookingBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return null;
  }
  if (!request.body || Number(request.headers.get("content-length")) > maxBodyBytes) {
    return null;
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBodyBytes) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function proxyBooking(request: Request, path: "availability" | "reservations") {
  const config = readBookingConfig();
  if (!config) return errorResponse("unavailable", 503);

  const headers = new Headers({ Accept: "application/json" });
  // The production origin is reachable only through the local Cloudflare Tunnel.
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (!config.fake && clientIp && isIP(clientIp)) {
    headers.set("X-Booking-Client-IP", clientIp);
  }

  try {
    const body = request.method === "POST" ? await readBookingBody(request) : undefined;
    if (body === null) return errorResponse("invalid_request", 400);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(new URL(`/api/booking/${path}`, config.baseUrl), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.headers.get("Content-Type")?.includes("json")) {
      return errorResponse("unavailable", 503);
    }

    const retryAfter = response.headers.get("Retry-After");
    const responseHeaders = new Headers(noStore);
    if (retryAfter) responseHeaders.set("Retry-After", retryAfter);

    return Response.json(await response.json(), { status: response.status, headers: responseHeaders });
  } catch {
    return errorResponse("unavailable", 503);
  }
}
