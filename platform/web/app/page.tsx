export default function PlatformHome() {
  return (
    <main className="entry">
      <header className="entry-nav">
        <span className="wordmark">
          MAGS <span>Booking</span>
        </span>
        <a href="/admin">MAGS-admin</a>
      </header>
      <div className="entry-layout">
        <section>
          <h1>
            Din salon.
            <br />
            Din kalender.
          </h1>
          <p>
            Åbn dagens aftaler, find plads til en kunde, og få overblik over
            holdet.
          </p>
          <a className="primary" href="/salon">
            Log ind i salonen
          </a>
          <p className="entry-hint">
            Vil du booke en behandling? Brug bookinglinket fra din frisør.
          </p>
        </section>
        <div
          className="entry-photo"
          role="img"
          aria-label="En frisør i gang med en klipning i salonen"
        />
      </div>
    </main>
  );
}
