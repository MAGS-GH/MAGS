"use client";

type Config = { issuer: string; clientId: string };
type Tokens = { access_token: string; refresh_token?: string };
type Attempt = { state: string; verifier: string; destination: string; created: number };
const credentials = "mags.booking.session";
const flow = "mags.booking.login";
export const sessionExpiredEvent = "mags-booking-login-required";
let refreshing: Promise<Tokens> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public affected?: { id: string; customerName: string; startsAt: string }[],
  ) {
    super(message);
  }
}

function readTokens(): Tokens | null {
  try {
    return JSON.parse(sessionStorage.getItem(credentials) || "null");
  } catch {
    return null;
  }
}

function expireSession() {
  if (!sessionStorage.getItem(credentials)) return;
  sessionStorage.removeItem(credentials);
  window.dispatchEvent(new Event(sessionExpiredEvent));
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function configuration(): Promise<Config> {
  const response = await fetch("/auth/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Login er midlertidigt utilgængeligt. Prøv igen.");
  const config: Config = await response.json();
  if (!config.clientId) throw new Error("Login til arbejdspladsen er endnu ikke aktiveret. Kontakt MAGS.");
  return config;
}

export async function beginLogin() {
  const { issuer, clientId } = await configuration();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const destination = location.pathname + location.search + location.hash;
  sessionStorage.setItem(flow, JSON.stringify({ state, verifier, destination, created: Date.now() }));
  const authorize = new URL("/oauth/authorize", issuer);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: location.origin + "/auth/callback",
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  }).toString();
  location.assign(authorize.href);
}

async function exchange(values: Record<string, string>): Promise<Tokens> {
  const { issuer, clientId } = await configuration();
  const response = await fetch(new URL("/oauth/token", issuer), {
    method: "POST",
    cache: "no-store",
    body: new URLSearchParams({ ...values, client_id: clientId }),
  });
  if (!response.ok) throw new ApiError("Dit login er udløbet. Log ind igen.", 401);
  const result: Tokens = await response.json();
  if (!result.access_token) throw new Error("Login returnerede ingen adgang til platformen.");
  sessionStorage.setItem(
    credentials,
    JSON.stringify({ access_token: result.access_token, refresh_token: result.refresh_token }),
  );
  return result;
}

let callback: Promise<string> | null = null;
export function completeLogin() {
  callback ??= (async () => {
    const query = new URLSearchParams(location.search);
    const attempt: Attempt | null = JSON.parse(sessionStorage.getItem(flow) || "null");
    sessionStorage.removeItem(flow);
    history.replaceState(null, "", "/auth/callback");
    if (
      !attempt ||
      query.get("state") !== attempt.state ||
      Date.now() - attempt.created > 900000 ||
      !query.get("code")
    ) {
      throw new Error("Login kunne ikke afsluttes. Åbn arbejdspladsen eller dit invitationslink igen.");
    }
    await exchange({
      grant_type: "authorization_code",
      code: query.get("code")!,
      code_verifier: attempt.verifier,
      redirect_uri: location.origin + "/auth/callback",
    });
    const destination = new URL(attempt.destination, location.origin);
    return destination.origin === location.origin ? destination.href : "/salon";
  })();
  return callback;
}

export function logout() {
  sessionStorage.removeItem(credentials);
  sessionStorage.removeItem(flow);
  location.replace("/salon");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/") || new URL(path, location.origin).origin !== location.origin)
    throw new Error("Ugyldig API-adresse.");
  const tokens = readTokens();
  if (!tokens) throw new ApiError("Log ind for at åbne arbejdspladsen.", 401);
  const send = (token: string) => {
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + token);
    if (typeof options.body === "string") headers.set("Content-Type", "application/json");
    return fetch(path, { ...options, cache: "no-store", redirect: "error", headers });
  };
  let response = await send(tokens.access_token);
  if (response.status === 401 && tokens.refresh_token) {
    const latest = readTokens();
    try {
      const renewed =
        latest && latest.access_token !== tokens.access_token
          ? latest
          : await (refreshing ??= exchange({
              grant_type: "refresh_token",
              refresh_token: tokens.refresh_token,
            }).finally(() => {
              refreshing = null;
            }));
      response = await send(renewed.access_token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expireSession();
      throw error;
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401) expireSession();
    throw new ApiError(
      typeof body?.error === "string"
        ? body.error
        : response.status === 403
          ? "Du har ikke adgang til denne funktion."
          : "Handlingen kunne ikke gennemføres. Prøv igen.",
      response.status,
      Array.isArray(body?.affected)
        ? body.affected
        : Array.isArray(body?.appointments)
          ? body.appointments.map((item: { id: string; customerName: string; start: string }) => ({
              id: item.id,
              customerName: item.customerName,
              startsAt: item.start,
            }))
          : undefined,
    );
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  const content = await response.text();
  return content ? (JSON.parse(content) as T) : (undefined as T);
}

export function mutate<T>(path: string, method: string, data?: unknown) {
  return api<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });
}
