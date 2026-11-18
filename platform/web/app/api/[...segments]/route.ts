import { visitorHeaders } from "../../../lib/upstream";
type Context = { params: Promise<{ segments: string[] }> };
const noStore = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: noStore });
}
async function proxy(req: Request, ctx: Context) {
  const { segments } = await ctx.params;
  if (
    segments.some(
      (s) => !/^[a-zA-Z0-9_.-]+$/.test(s) || s === "." || s === "..",
    )
  )
    return error(404, "Siden findes ikke.");
  const bits = segments.slice();
  if (bits[0] === "guest") {
    const token = req.headers.get("X-Aftale");
    if (!token || !/^[a-zA-Z0-9_-]{32,128}$/.test(token))
      return error(404, "Aftalelinket er ugyldigt.");
    bits.splice(1, 0, token);
  }
  const limit = 5 * 1024 * 1024;
  if (Number(req.headers.get("Content-Length")) > limit)
    return error(413, "Filen er for stor.");
  const headers = visitorHeaders(req.headers);
  for (const h of ["Content-Type", "Authorization", "Accept"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  try {
    const upstream = new URL(
      "/api/" + bits.join("/"),
      process.env.SALON_API_URL || "http://salon-api:8080",
    );
    upstream.search = new URL(req.url).search;
    let body: ArrayBuffer | undefined;
    if (req.body) {
      const reader = req.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          return error(413, "Filen er for stor.");
        }
        chunks.push(new Uint8Array(value));
      }
      body = await new Blob(chunks).arrayBuffer();
    }
    const res = await fetch(upstream, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const outbound = new Headers(noStore);
    for (const h of ["Content-Type", "Content-Disposition", "Retry-After"]) {
      const v = res.headers.get(h);
      if (v) outbound.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers: outbound });
  } catch {
    return error(503, "Kalenderen kan ikke nås lige nu. Prøv igen om lidt.");
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
