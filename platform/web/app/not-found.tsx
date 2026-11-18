import Link from "next/link";
export default function NotFound() {
  return (
    <main className="simple">
      <span className="wordmark">
        MAGS <span>Booking</span>
      </span>
      <h1>Bookingsiden findes ikke</h1>
      <p>Tjek linket fra din frisør, eller kontakt salonen direkte.</p>
      <Link href="/">Gå til MAGS Booking</Link>
    </main>
  );
}
