"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, ApiError, beginLogin, logout, sessionExpiredEvent } from "../auth/client";
import type { Me } from "./types";
import "./workspace.css";

export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Handlingen kunne ikke gennemføres.";

export function useResource<T>(
  path: string | null,
  revision = 0,
  retainDuringRefresh = false,
): { value?: T; error?: Error } {
  const key = path + "|" + revision;
  const [stored, setStored] = useState<{ key: string; value?: T; error?: Error } | null>(null);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setStored({ key, value });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setStored({ key, error });
      });
    return () => controller.abort();
  }, [path, key]);
  return stored && (stored.key === key || (retainDuringRefresh && stored.key.startsWith(path + "|")))
    ? stored
    : {};
}

export function useAction() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }, []);
  return { pending, error, run, setError };
}

export function Feedback({ error, status }: { error?: string; status?: string }) {
  if (error)
    return (
      <p className="wk-error" role="alert">
        {error}
      </p>
    );
  if (status)
    return (
      <p className="wk-notice" role="status">
        {status}
      </p>
    );
  return null;
}

export function Load({ error, retry }: { error?: Error; retry?: () => void }) {
  return error ? (
    <div className="wk-empty">
      <Feedback error={error.message} />
      {retry && (
        <button type="button" onClick={retry}>
          Prøv igen
        </button>
      )}
    </div>
  ) : (
    <div role="status" className="wk-loading">
      <span>Henter oplysninger …</span>
    </div>
  );
}

export function Gate({
  children,
  title = "Din arbejdsplads",
  description = "Log ind for at åbne salonens kalender og bookinger.",
}: {
  children: (me: Me) => ReactNode;
  title?: string;
  description?: string;
}) {
  const [retry, setRetry] = useState(0);
  const { value, error } = useResource<Me>("/api/me", retry);
  const action = useAction();
  useEffect(() => {
    const expired = () => setRetry((v) => v + 1);
    window.addEventListener(sessionExpiredEvent, expired);
    return () => window.removeEventListener(sessionExpiredEvent, expired);
  }, []);
  if (value) return children(value);
  const needsLogin = error instanceof ApiError && error.status === 401;
  return (
    <main className="workspace wk-entry">
      <section>
        <Link href="/" className="wk-brand">
          MAGS Booking
        </Link>
        <h1>{title}</h1>
        <p>{description}</p>
        <noscript>Aktivér JavaScript i din browser for at logge ind på arbejdspladsen.</noscript>
        {needsLogin ? (
          <>
            <button className="wk-primary" disabled={action.pending} onClick={() => action.run(beginLogin)}>
              Log ind
            </button>
            <Feedback error={action.error} />
          </>
        ) : (
          <Load error={error} retry={() => setRetry(retry + 1)} />
        )}
      </section>
    </main>
  );
}

export function Workspace({
  name,
  me,
  children,
  nav,
}: {
  name: string;
  me: Me;
  children: ReactNode;
  nav?: ReactNode;
}) {
  return (
    <div className="workspace">
      <header className="wk-top">
        <div className="wk-limit">
          <div className="wk-identity">
            <Link className="wk-brand" href={me.admin ? "/admin" : "/salon"}>
              MAGS Booking
            </Link>
            <span className="wk-place" title={name}>
              {name}
            </span>
          </div>
          <div className="wk-top-actions">
            {me.admin && <Link href="/admin">Administration</Link>}
            <button onClick={logout}>Log ud</button>
          </div>
        </div>
      </header>
      {nav && (
        <nav aria-label="Salonens navigation" className="wk-nav">
          <div className="wk-limit">{nav}</div>
        </nav>
      )}
      <main id="indhold" className="wk-limit wk-main">
        {children}
      </main>
    </div>
  );
}

export function CopyLink({ url, label = "Kopiér link" }: { url: string; label?: string }) {
  const [state, setState] = useState("");
  return (
    <div className="wk-copy">
      <input readOnly aria-label={label} value={url} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setState("Kopieret");
          } catch {
            setState("Markér og kopiér linket");
          }
        }}
      >
        {state || label}
      </button>
    </div>
  );
}

export function InviteResult({ token }: { token: string }) {
  return (
    <div className="wk-note">
      <strong>Invitationslink</strong>
      <p>Del linket direkte med modtageren. Det kan bruges én gang.</p>
      <CopyLink url={location.origin + "/invitation#token=" + encodeURIComponent(token)} />
    </div>
  );
}
