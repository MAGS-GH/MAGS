"use client";

import { useState } from "react";
import Link from "next/link";
import { Gate, Workspace, useResource, Load, Feedback } from "./common";
import { Diary } from "./calendar";
import { Services, Team } from "./catalog";
import { Customers } from "./customers";
import { Settings } from "./settings";
import { labels, type Me, type Setup } from "./types";

type Location = { id: string; view: string; date: string; customer: string; appointment: string };

function Station({ me, id, view, date, customer, appointment }: { me: Me } & Location) {
  const selected = id || (me.salons.length === 1 ? me.salons[0].id : "");
  const membership = me.salons.find((v) => v.id === selected);
  const entitled = me.admin || !!membership;
  const owner = me.admin || membership?.role === "owner";
  const base = "/api/salons/" + encodeURIComponent(selected);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const { value: setup, error } = useResource<Setup>(selected && entitled ? base + "/setup" : null, revision);
  const refresh = (msg: string) => {
    setNotice(msg);
    setRevision((v) => v + 1);
  };
  const tabs = [
    ["kalender", "Kalender"],
    ["kunder", "Kunder"],
    ...(owner
      ? [
          ["behandlinger", "Behandlinger"],
          ["personale", "Personale"],
          ["indstillinger", "Indstillinger"],
        ]
      : []),
  ];
  const current = tabs.some((t) => t[0] === view) ? view : "kalender";
  const url = "/salon?id=" + encodeURIComponent(selected);
  const nav = setup ? (
    <>
      {tabs.map(([key, text]) => (
        <Link aria-current={key === current ? "page" : undefined} href={url + "&view=" + key} key={key}>
          {text}
        </Link>
      ))}
      {me.salons.length > 1 && <Link href="/salon">Skift salon</Link>}
    </>
  ) : undefined;
  return (
    <Workspace me={me} name={setup?.salon.name ?? "Arbejdsplads"} nav={nav}>
      {!selected ? (
        <>
          <h1>{me.salons.length ? "Vælg salon" : "Din arbejdsplads"}</h1>
          {!me.salons.length ? (
            <div className="wk-empty">
              <h2>{me.admin ? "Salonadministration" : "Du er logget ind"}</h2>
              <p>
                {me.admin
                  ? "Åbn administrationen for at vælge eller oprette en salon."
                  : "Åbn dit invitationslink for at tilknytte salonen til din konto."}
              </p>
              {me.admin && (
                <Link className="wk-primary" href="/admin">
                  Administrér saloner
                </Link>
              )}
            </div>
          ) : (
            <div className="wk-list">
              {me.salons.map((s) => (
                <article key={s.id}>
                  <div>
                    <Link className="wk-row-title" href={"/salon?id=" + s.id}>
                      {s.name}
                    </Link>
                    <small>{labels[s.role]}</small>
                  </div>
                  <span>{labels[s.status]}</span>
                </article>
              ))}
            </div>
          )}
        </>
      ) : !entitled ? (
        <div className="wk-empty">
          <h1>Adgang til salon</h1>
          <p>Din konto er ikke tilknyttet denne salon.</p>
          <Link href="/salon">Vis mine saloner</Link>
        </div>
      ) : !setup ? (
        <Load error={error} retry={() => setRevision((v) => v + 1)} />
      ) : (
        <>
          <Feedback status={notice} />
          {owner && setup.salon.status !== "published" && current !== "indstillinger" && (
            <div className="wk-draft">
              <strong>
                {setup.salon.status === "draft" ? "Salonen er en kladde" : "Onlinebooking er pauseret"}
              </strong>
              <Link href={url + "&view=indstillinger"}>
                {setup.salon.status === "draft" ? "Klargør bookingsiden" : "Se udgivelse"}
              </Link>
            </div>
          )}
          {current === "kalender" && (
            <Diary
              key={selected + date + customer + appointment}
              base={base}
              setup={setup}
              date={date}
              customerId={customer}
              appointmentId={appointment}
              owner={owner}
              staffId={membership?.staffId ?? null}
              done={setNotice}
            />
          )}
          {current === "kunder" && (
            <Customers
              key={selected}
              base={base}
              salonId={selected}
              owner={owner}
              selected={customer}
              done={setNotice}
            />
          )}
          {current === "behandlinger" && <Services setup={setup} base={base} done={refresh} />}
          {current === "personale" && <Team setup={setup} base={base} done={refresh} />}
          {current === "indstillinger" && <Settings {...{ setup, base, me }} done={refresh} />}
        </>
      )}
    </Workspace>
  );
}

export function SalonWorkspace(props: Location) {
  return <Gate>{(me) => <Station key={props.id} me={me} {...props} />}</Gate>;
}
