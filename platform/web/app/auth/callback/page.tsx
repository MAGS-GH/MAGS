"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { completeLogin } from "../client";
import "../../salon/workspace.css";

export default function Callback() {
  const [error, setError] = useState("");
  useEffect(() => {
    completeLogin()
      .then((url) => location.replace(url))
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <main className="workspace wk-entry">
      <div>
        <Link className="wk-brand" href="/">
          MAGS Booking
        </Link>
        <h1>{error ? "Login afbrudt" : "Åbner din arbejdsplads"}</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <Link className="wk-primary" href="/salon">
              Til arbejdspladsen
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
