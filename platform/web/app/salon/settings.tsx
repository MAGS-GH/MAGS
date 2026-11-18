"use client";

import { useState } from "react";
import { api, mutate } from "../auth/client";
import { CopyLink, Feedback, InviteResult, Load, useAction, useResource } from "./common";
import { Upload } from "./catalog";
import { labels, type Me, type Role, type Setup } from "./types";

type Props = { base: string; setup: Setup; done: (s: string) => void };

function MemberAccess({ base, setup, done, me }: Props & { me: Me }) {
  const [role, setRole] = useState<Role>("reception");
  const [token, setToken] = useState("");
  const [newInvitations, setNewInvitations] = useState<Setup["invitations"]>([]);
  const pendingInvites = [
    ...newInvitations,
    ...setup.invitations.filter((i) => !newInvitations.some((v) => v.id === i.id)),
  ];
  const action = useAction();
  return (
    <section className="wk-panel">
      <h2>Adgang til arbejdspladsen</h2>
      <form
        className="wk-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          action.run(async () => {
            const staffId = role === "staff" ? String(data.get("staffId")) : null;
            const r = await mutate<{ id: string; token: string; expiresAt: string }>(
              base + "/invites",
              "POST",
              { role, staffId },
            );
            setToken(r.token);
            setNewInvitations((current) => [{ id: r.id, role, staffId, expiresAt: r.expiresAt }, ...current]);
          });
        }}
      >
        <div className="wk-form-grid">
          <label>
            Rolle
            <select aria-label="Rolle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="reception">Reception</option>
              <option value="staff">Frisør</option>
              <option value="owner">Ejer</option>
            </select>
          </label>
          {role === "staff" && (
            <label>
              Medarbejder
              <select aria-label="Medarbejder" name="staffId" required defaultValue="">
                <option value="" disabled>
                  Vælg medarbejder
                </option>
                {setup.staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <button disabled={action.pending}>Opret invitationslink</button>
      </form>
      {token && <InviteResult token={token} />}
      <Feedback error={action.error} />
      {setup.members.length > 0 && (
        <>
          <h3>Aktive adgange</h3>
          <div className="wk-list">
            {setup.members.map((m) => (
              <article key={m.sub}>
                <div>
                  <strong>
                    {m.name || setup.staff.find((s) => s.id === m.staffId)?.name || labels[m.role]}
                    {m.sub === me.sub ? " (dig)" : ""}
                  </strong>
                  <small>
                    {labels[m.role]}
                    {!m.name && !m.staffId ? " (konto " + m.sub.slice(0, 8) + ")" : ""}
                  </small>
                </div>
                {m.sub !== me.sub && (
                  <button
                    disabled={action.pending}
                    onClick={() => {
                      if (confirm("Tilbagekald denne persons adgang til salonen?"))
                        action.run(async () => {
                          await mutate(base + "/members/" + encodeURIComponent(m.sub), "DELETE");
                          done("Adgangen er tilbagekaldt.");
                        });
                    }}
                  >
                    Tilbagekald
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {pendingInvites.length > 0 && (
        <>
          <h3>Åbne invitationer</h3>
          <div className="wk-list">
            {pendingInvites.map((i) => (
              <article key={i.id}>
                <strong>{labels[i.role]}</strong>
                <small>Udløber {new Date(i.expiresAt).toLocaleDateString("da-DK")}</small>
                <button
                  disabled={action.pending}
                  onClick={() => {
                    if (confirm("Tilbagekald invitationen?"))
                      action.run(async () => {
                        await mutate(base + "/invites/" + i.id, "DELETE");
                        done("Invitationen er tilbagekaldt.");
                      });
                  }}
                >
                  Tilbagekald
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const auditLabels: Record<string, string> = {
  "salon.created": "Oprettede salon",
  "settings.updated": "Opdaterede salonindstillinger",
  "salon.published": "Åbnede for booking",
  "salon.paused": "Pauserede booking",
  "staff.created": "Oprettede medarbejder",
  "staff.updated": "Ændrede medarbejder",
  "service.created": "Oprettede behandling",
  "service.updated": "Ændrede behandling",
  "invitation.created": "Oprettede invitation",
  "invitation.redeemed": "Indløste invitation",
  "invitation.revoked": "Tilbagekaldte invitation",
  "membership.revoked": "Tilbagekaldte adgang",
  "media.uploaded": "Uploadede salonbillede",
  "salon.exported": "Eksporterede salondata",
  "appointment.reception.create": "Bookede tid i receptionen",
  "appointment.guest.create": "Bookede tid på bookingsiden",
  "appointment.staff.move": "Flyttede aftale i receptionen",
  "appointment.guest.move": "Flyttede egen aftale",
  "appointment.staff.cancel": "Aflyste aftale i receptionen",
  "appointment.guest.cancel": "Aflyste egen aftale",
  "customer.anonymize": "Anonymiserede kunde",
  "block.create": "Blokerede tid",
  "block.delete": "Frigav blokeret tid",
};

function DataTools({ base, slug }: { base: string; slug: string }) {
  const [show, setShow] = useState(false);
  const [retry, setRetry] = useState(0);
  const action = useAction();
  const log = useResource<
    { action: string; actorSub: string | null; entityId: string | null; createdAt: string }[]
  >(show ? base + "/audit" : null, retry);
  return (
    <section className="wk-panel">
      <h2>Salonens data</h2>
      <div className="wk-actions">
        <button
          disabled={action.pending}
          onClick={() =>
            action.run(async () => {
              const data = await api<unknown>(base + "/export");
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = slug + "-eksport.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 30000);
            })
          }
        >
          Hent dataeksport
        </button>
        <button aria-expanded={show} onClick={() => setShow(!show)}>
          {show ? "Skjul ændringslog" : "Vis ændringslog"}
        </button>
      </div>
      <Feedback error={action.error} />
      {show &&
        (!log.value ? (
          <Load error={log.error} retry={() => setRetry(retry + 1)} />
        ) : log.value.length ? (
          <ol className="wk-log">
            {log.value.map((l, i) => (
              <li key={i}>
                <time>
                  {new Date(l.createdAt).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}
                </time>
                <span>{auditLabels[l.action] ?? l.action}</span>
                <small>{l.actorSub ? "Konto " + l.actorSub.slice(0, 8) : "Onlinebooking"}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p>Ingen registrerede ændringer endnu.</p>
        ))}
    </section>
  );
}

export function Settings({ base, setup, done, me }: Props & { me: Me }) {
  const { salon: s } = setup;
  const action = useAction();
  const [logo, setLogo] = useState(s.logoUrl);
  const [cover, setCover] = useState(s.coverUrl);
  return (
    <>
      <div className="wk-title">
        <div>
          <h1>Salonindstillinger</h1>
          <p>Bookingside, adgang og offentliggørelse.</p>
        </div>
        <a href={"/s/" + s.slug + "?preview=" + s.id}>Forhåndsvis booking</a>
      </div>
      <section className="wk-panel">
        <div className="wk-spread">
          <h2>Bookingsiden</h2>
          <span className="wk-status">{labels[s.status]}</span>
        </div>
        <CopyLink url={location.origin + "/s/" + s.slug} label="Kopiér bookinglink" />
        {setup.readiness.missing.length > 0 && (
          <>
            <h3>Mangler før udgivelse</h3>
            <ul>
              {setup.readiness.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </>
        )}
        {s.status === "published" ? (
          <button
            disabled={action.pending}
            onClick={() => {
              if (confirm("Pause for nye onlinebookinger? Eksisterende aftaler bliver stående."))
                action.run(async () => {
                  await mutate(base + "/publication", "PUT", { status: "paused" });
                  done("Onlinebooking er pauseret.");
                });
            }}
          >
            Sæt onlinebooking på pause
          </button>
        ) : (
          <button
            className="wk-primary"
            disabled={!setup.readiness.ready || action.pending}
            onClick={() =>
              action.run(async () => {
                await mutate(base + "/publication", "PUT", { status: "published" });
                done("Bookingsiden er udgivet.");
              })
            }
          >
            Åbn for onlinebooking
          </button>
        )}
      </section>
      <Feedback error={action.error} />
      <form
        className="wk-panel wk-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          action.run(async () => {
            await mutate(base + "/settings", "PUT", {
              name: d.get("name"),
              address: d.get("address"),
              phone: d.get("phone"),
              accent: d.get("accent"),
              logoUrl: logo,
              coverUrl: cover,
              slotMinutes: Number(d.get("slotMinutes")),
              horizonDays: Number(d.get("horizonDays")),
              noticeHours: Number(d.get("noticeHours")),
              changeHours: Number(d.get("changeHours")),
            });
            done("Salonindstillingerne er gemt.");
          });
        }}
      >
        <h2>Salonens profil</h2>
        <div className="wk-form-grid">
          <label>
            Salonnavn
            <input name="name" required defaultValue={s.name} />
          </label>
          <label>
            Telefon
            <input name="phone" type="tel" required defaultValue={s.phone} />
          </label>
          <label>
            Gade, postnummer og by
            <input name="address" required defaultValue={s.address} />
          </label>
          <label>
            Accentfarve
            <input name="accent" type="color" defaultValue={s.accent} />
          </label>
        </div>
        <div className="wk-form-grid">
          <Upload base={base} label="Salonlogo" value={logo} onChange={setLogo} />
          <Upload base={base} label="Salonbillede" value={cover} onChange={setCover} />
        </div>
        <h2>Bookingregler</h2>
        <div className="wk-form-grid">
          <label>
            Afstand mellem starttider
            <select name="slotMinutes" defaultValue={s.slotMinutes}>
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n} minutter
                </option>
              ))}
            </select>
          </label>
          <label>
            Bookinghorisont i dage
            <input name="horizonDays" type="number" required min={1} max={365} defaultValue={s.horizonDays} />
          </label>
          <label>
            Mindste varsel i timer
            <input name="noticeHours" type="number" required min={0} max={168} defaultValue={s.noticeHours} />
          </label>
          <label>
            Ændringsfrist i timer
            <input name="changeHours" type="number" required min={0} max={168} defaultValue={s.changeHours} />
          </label>
        </div>
        <button className="wk-primary" disabled={action.pending}>
          Gem indstillinger
        </button>
      </form>
      <MemberAccess {...{ base, setup, done, me }} />
      <DataTools base={base} slug={s.slug} />
    </>
  );
}
