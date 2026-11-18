"use client";

import { useState } from "react";
import Link from "next/link";
import { mutate } from "../auth/client";
import { Feedback, Gate, InviteResult, Load, useAction, useResource, Workspace } from "../salon/common";
import { labels, type Me, type Salon } from "../salon/types";

function Directory({ me }: { me: Me }) {
  const [revision, setRevision] = useState(0);
  const [create, setCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [invite, setInvite] = useState<{ name: string; token: string } | null>(null);
  const [created, setCreated] = useState("");
  const action = useAction();
  const { value, error } = useResource<Salon[]>(me.admin ? "/api/admin/salons" : null, revision);
  const list = value?.filter((s) => s.name.toLocaleLowerCase("da").includes(search.toLocaleLowerCase("da")));
  return (
    <Workspace name="Administration" me={me}>
      {!me.admin ? (
        <>
          <h1>Adgang til administration</h1>
          <p>Din konto har adgang til salonarbejdspladsen.</p>
          <Link href="/salon">Åbn min salon</Link>
        </>
      ) : (
        <>
          <div className="wk-title">
            <div>
              <h1>Saloner</h1>
              <p>Opret saloner, del ejeradgang og følg udgivelsen.</p>
            </div>
            <button
              className={create ? "" : "wk-primary"}
              onClick={() => {
                setCreate(!create);
                setCreated("");
                setInvite(null);
                action.setError("");
              }}
            >
              {create ? "Luk formular" : "Opret salon"}
            </button>
          </div>
          {create && (
            <form
              className="wk-panel wk-form"
              onSubmit={(e) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                action.run(async () => {
                  const s = await mutate<Salon>("/api/admin/salons", "POST", d);
                  setCreate(false);
                  setCreated(s.name + " er oprettet som kladde.");
                  setRevision(revision + 1);
                });
              }}
            >
              <h2>Ny salon</h2>
              <div className="wk-form-grid">
                <label>
                  Salonnavn
                  <input required name="name" maxLength={120} />
                </label>
                <label>
                  Bookingadresse
                  <input
                    required
                    name="slug"
                    placeholder="salon-luna"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={60}
                  />
                  <small>Vises som /s/salon-luna</small>
                </label>
                <label>
                  Gade, postnummer og by
                  <input required name="address" maxLength={300} />
                </label>
                <label>
                  Salonens telefon
                  <input name="phone" type="tel" required maxLength={40} />
                </label>
              </div>
              <button className="wk-primary" disabled={action.pending}>
                Opret som kladde
              </button>
            </form>
          )}
          <Feedback error={action.error} status={created} />
          {invite && (
            <section aria-label={"Invitation til " + invite.name}>
              <h2>{invite.name}</h2>
              <InviteResult token={invite.token} />
            </section>
          )}
          <div className="wk-toolbar">
            <label>
              Søg i saloner
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Salonnavn"
              />
            </label>
          </div>
          {!value ? (
            <Load error={error} retry={() => setRevision(revision + 1)} />
          ) : !list?.length ? (
            <div className="wk-empty">
              <h2>{search ? "Ingen matchende saloner" : "Den første salon"}</h2>
              <p>
                {search
                  ? "Prøv et andet salonnavn."
                  : "Opret en kladde for at give ejeren adgang til sin arbejdsplads."}
              </p>
            </div>
          ) : (
            <div className="wk-list">
              {list.map((s) => (
                <article key={s.id}>
                  <div>
                    <Link className="wk-row-title" href={"/salon?id=" + s.id}>
                      {s.name}
                    </Link>
                    <small>/s/{s.slug}</small>
                  </div>
                  <span className="wk-status">{labels[s.status]}</span>
                  <button
                    disabled={action.pending}
                    onClick={() =>
                      action.run(async () => {
                        const result = await mutate<{ token: string }>(
                          "/api/salons/" + s.id + "/invites",
                          "POST",
                          { role: "owner" },
                        );
                        setInvite({ name: s.name, token: result.token });
                        setCreated("");
                      })
                    }
                  >
                    Invitér ejer
                  </button>
                  <Link href={"/salon?id=" + s.id}>Åbn salon</Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </Workspace>
  );
}
export default function Admin() {
  return (
    <Gate title="MAGS administration" description="Log ind for at oprette en salon og give ejeren adgang.">
      {(me) => <Directory me={me} />}
    </Gate>
  );
}
