import { isIP } from "node:net";

// Only the ingress proxy supplies CF-Connecting-IP. Never trust X-Real-IP from a browser.
export function visitorHeaders(incoming: Pick<Headers, "get">) {
  const out = new Headers();
  const ip = incoming.get("CF-Connecting-IP");
  if (ip && isIP(ip)) out.set("X-Real-IP", ip);
  return out;
}
