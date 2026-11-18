"use client";

import { useState, useDeferredValue } from "react";
import Link from "next/link";
import { mutate } from "../auth/client";
import { Feedback, Load, useAction, useResource } from "./common";
import { money, timeText, type Customer, type History } from "./types";

export function Customers({
  base,
  salonId,
  owner,
  selected,
  done,
}: {
  base: string;
  salonId: string;
  owner: boolean;
  selected: string;
  done: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const search = useDeferredValue(q);
  const [revision, setRevision] = useState(0);
  const action = useAction();
  const list = useResource<{ customers: Customer[] }>(
    base + "/customers?q=" + encodeURIComponent(search),
    revision,
  );
  const detail = useResource<History>(
    selected ? base + "/customers/" + encodeURIComponent(selected) : null,
    revision,
  );
  const path = "/salon?id=" + salonId + "&view=kunder";
  return (
    <>
      <div className="wk-title">
        <div>
          <h1>Kunder</h1>
          <p>Find kontaktoplysninger og aftaler i salonen.</p>
        </div>
      </div>
      {selected ? (
        <>
          <Link href={path}>Alle kunder</Link>
          {detail.value ? (
            <section className="wk-panel">
              <div className="wk-spread">
                <div>
                  <h2>{detail.value.name}</h2>
                  {detail.value.phone && <a href={"tel:" + detail.value.phone}>{detail.value.phone}</a>}
                </div>
                {!!detail.value.phone && (
                  <Link className="wk-primary" href={"/salon?id=" + salonId + "&customer=" + detail.value.id}>
                    Book tid
                  </Link>
                )}
              </div>
              <h3>Aftalehistorik</h3>
              {!detail.value.appointments.length ? (
                <p>Der er ingen aftaler endnu.</p>
              ) : (
                <div className="wk-list">
                  {detail.value.appointments.map((a) => (
                    <article key={a.id}>
                      <div>
                        <strong>{a.serviceName}</strong>
                        <small>{a.staffName}</small>
                      </div>
                      <span>
                        {new Date(a.start).toLocaleDateString("da-DK", { timeZone: "Europe/Copenhagen" })} kl.{" "}
                        {timeText(a.start)}
                      </span>
                      <span>{money(a.priceMinor)}</span>
                      <span className="wk-status">{a.status === "cancelled" ? "Aflyst" : "Booket"}</span>
                    </article>
                  ))}
                </div>
              )}
              {owner && !!detail.value.phone && (
                <button
                  className="wk-danger"
                  disabled={action.pending}
                  onClick={() => {
                    if (confirm("Anonymisér kundens navn og telefonnummer permanent?"))
                      action.run(async () => {
                        await mutate(base + "/customers/" + selected + "/anonymize", "POST");
                        setRevision(revision + 1);
                        done("Kunden er anonymiseret.");
                      });
                  }}
                >
                  Anonymisér kunde
                </button>
              )}
              <Feedback error={action.error} />
            </section>
          ) : (
            <Load error={detail.error} retry={() => setRevision(revision + 1)} />
          )}
        </>
      ) : (
        <>
          <label className="wk-search">
            Find kunde
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Navn eller telefonnummer"
            />
          </label>
          {!list.value ? (
            <Load error={list.error} retry={() => setRevision(revision + 1)} />
          ) : !list.value.customers.length ? (
            <div className="wk-empty">
              <h2>{search ? "Ingen kunder fundet" : "Salonens kundekartotek"}</h2>
              <p>
                {search
                  ? "Prøv et andet navn eller nummer."
                  : "Når den første aftale bliver booket, vises kunden her."}
              </p>
            </div>
          ) : (
            <div className="wk-list">
              {list.value.customers.map((c) => (
                <article key={c.id}>
                  <Link className="wk-row-title" href={path + "&customer=" + c.id}>
                    {c.name}
                  </Link>
                  <span>{c.phone}</span>
                  <Link href={path + "&customer=" + c.id}>Åbn kundekort</Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
