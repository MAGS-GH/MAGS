import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Booking, Preview } from "../../customer/booking";
import type { Salon } from "../../../lib/booking";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book en behandling" };
export default async function SalonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) notFound();
  if (preview && /^[0-9a-f-]{36}$/i.test(preview))
    return <Preview salonId={preview} />;
  const response = await fetch(
    new URL(
      "/api/public/salons/" + slug,
      process.env.SALON_API_URL || "http://salon-api:8080",
    ),
    { cache: "no-store", signal: AbortSignal.timeout(12000) },
  ).catch(() => null);
  if (response?.status === 404) notFound();
  if (!response?.ok)
    return (
      <main className="simple">
        <h1>Booking er midlertidigt lukket</h1>
        <p>Kontakt salonen direkte, eller prøv igen om lidt.</p>
        <a href={"/s/" + slug}>Prøv igen</a>
      </main>
    );
  return <Booking salon={(await response.json()) as Salon} />;
}
