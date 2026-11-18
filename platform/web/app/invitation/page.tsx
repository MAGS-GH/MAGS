"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { mutate } from "../auth/client";
import { Gate, useAction, Feedback, Workspace } from "../salon/common";
import type { Me } from "../salon/types";

function subscribe(notify: () => void) {
  addEventListener("hashchange", notify);
  return () => removeEventListener("hashchange", notify);
}
function Invitation({ me }: { me: Me }) {
  const hash = useSyncExternalStore(
    subscribe,
    () => location.hash,
    () => "",
  );
  const token = new URLSearchParams(hash.slice(1)).get("token");
  const action = useAction();
  return (
    <Workspace name="Invitation" me={me}>
      <section className="wk-detail">
        <h1>Din saloninvitation</h1>
        {token ? (
          <>
            <p>Acceptér invitationen for at knytte arbejdspladsen til den konto, du er logget ind med.</p>
            <button
              className="wk-primary"
              disabled={action.pending}
              onClick={() =>
                action.run(async () => {
                  const result = await mutate<{ salonId: string }>("/api/invitations/redeem", "POST", {
                    token,
                  });
                  history.replaceState(null, "", "/invitation");
                  location.replace("/salon?id=" + encodeURIComponent(result.salonId));
                })
              }
            >
              Acceptér invitation
            </button>
          </>
        ) : (
          <>
            <p>Åbn hele invitationslinket fra din salonejer eller MAGS.</p>
            <Link href="/salon">Til arbejdspladsen</Link>
          </>
        )}
        <Feedback error={action.error} />
      </section>
    </Workspace>
  );
}
export default function InvitationPage() {
  return (
    <Gate
      title="Du er inviteret"
      description="Log ind med din egen konto for at tage imod salonens invitation."
    >
      {(me) => <Invitation me={me} />}
    </Gate>
  );
}
