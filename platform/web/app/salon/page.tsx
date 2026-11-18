import { SalonWorkspace } from "./workspace";
import { localDate } from "./types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salonens arbejdsplads" };
type Query = Record<string, string | string[] | undefined>;
export default async function SalonPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const text = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  const requested = text("date");
  const parsed = new Date(requested + "T12:00:00Z");
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    !isNaN(parsed.getTime()) &&
    parsed.toISOString().startsWith(requested)
      ? requested
      : localDate();
  return (
    <SalonWorkspace
      id={text("id")}
      view={text("view")}
      date={date}
      customer={text("customer")}
      appointment={text("appointment")}
    />
  );
}
