"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { api } from "../auth/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ApiError,
  clock,
  jsonPost,
  longDate,
  money,
  request,
  type Appointment,
  type Availability,
  type Salon,
  type Service,
  type Slot,
} from "../../lib/booking";
import { Times } from "./times";

type Step = "service" | "time" | "staff" | "details";
const headings: Record<Step, string> = {
  service: "Vælg behandling",
  time: "Find en ledig tid",
  staff: "Vælg din frisør",
  details: "Bekræft din aftale",
};
const labels: Record<Step, string> = {
  service: "Behandling",
  time: "Tid",
  staff: "Frisør",
  details: "Bekræftelse",
};
const steps = Object.keys(headings) as Step[];
function readableAccent(accent: string | null): CSSProperties | undefined {
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return;
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return {
    "--brand": accent,
    "--on-brand":
      rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
        ? "#12100e"
        : "#ffffff",
  } as CSSProperties;
}
function Photo({
  src,
  className,
  alt = "",
}: {
  src: string | null;
  className: string;
  alt?: string;
}) {
  // Salon media are served by the private API through the same-origin proxy.
  return src?.startsWith("/api/") ? (
    <Image
      alt={alt}
      className={className}
      src={src}
      width={320}
      height={240}
      unoptimized
    />
  ) : null;
}
export function Preview({ salonId }: { salonId: string }) {
  const [data, setData] = useState<Salon>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Salon>("/api/salons/" + salonId + "/preview")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [salonId]);
  return data ? (
    <Booking salon={data} preview />
  ) : (
    <main className="simple">
      <h1>Forhåndsvisning</h1>
      <p role="status">{error || "Henter salonen …"}</p>
      <a href={"/salon?id=" + salonId}>Tilbage til salonen</a>
    </main>
  );
}
export function Booking({
  salon,
  preview = false,
}: {
  salon: Salon;
  preview?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [viewedDate, setViewedDate] = useState("");
  const [selectedAt, setSelectedAt] = useState(0);
  const [service, setService] = useState<Service>();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<Slot>();
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [sending, setSending] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const key = useRef({ signature: "", id: "" });
  const busy = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const base = preview
    ? "/api/salons/" + salon.id
    : "/api/public/salons/" + salon.slug;
  useEffect(() => {
    if (!service) return;
    let active = true;
    const path =
      base +
      "/availability?serviceId=" +
      service.id +
      (preview ? "&preview=true" : "");
    const loader = preview
      ? api<Availability>(path)
      : request<Availability>(path);
    loader
      .then((value) => {
        if (active)
          setAvailability({
            ...value,
            days: value.days.filter((d) => d.slots.length),
          });
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service, base, preview, reload]);
  function change(next: Step) {
    setStep(next);
    requestAnimationFrame(() => title.current?.focus({ preventScroll: false }));
  }
  function chooseService(next: Service) {
    setViewedDate("");
    setService(next);
    setSlot(undefined);
    setStaffId("");
    setAvailability(null);
    setLoadError("");
    setReload((v) => v + 1);
    setError("");
    change("time");
  }
  function chooseSlot(next: Slot) {
    setSelectedAt(Date.now());
    setSlot(next);
    setError("");
    setStaffId(next.staffIds.length === 1 ? next.staffIds[0] : "");
    change(next.staffIds.length === 1 ? "details" : "staff");
  }
  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!slot || !service || busy.current) return;
    if (preview) {
      setSimulated(true);
      return;
    }
    busy.current = true;
    setSending(true);
    setError("");
    const payload = {
      serviceId: service.id,
      expectedPriceMinor: service.priceMinor,
      expectedDurationMinutes: service.durationMinutes,
      start: slot.start,
      staffId: staffId || null,
      name: name.trim(),
      phone: phone.trim(),
    };
    const signature = JSON.stringify(payload);
    if (key.current.signature !== signature)
      key.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await request<{ appointment: Appointment; token: string }>(
        base + "/appointments",
        jsonPost({ ...payload, requestId: key.current.id }),
      );
      router.push("/aftale#" + encodeURIComponent(result.token));
    } catch (e) {
      if (e instanceof ApiError && e.code === "catalogue_changed") {
        setService(undefined);
        setSlot(undefined);
        setStaffId("");
        key.current = { signature: "", id: "" };
        router.refresh();
        change("service");
        setError(
          "Salonen har opdateret behandlingen. Gennemse den nye pris og varighed.",
        );
      } else if (e instanceof ApiError && e.status === 409) {
        setSlot(undefined);
        setAvailability(null);
        setLoadError("");
        setReload((v) => v + 1);
        key.current = { signature: "", id: "" };
        change("time");
        setError(
          "Tiden blev taget. Dine kontaktoplysninger er gemt her, mens du vælger en anden tid.",
        );
      } else setError(e instanceof Error ? e.message : "Prøv igen.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const staff = salon.staff.find((s) => s.id === staffId);
  const back =
    step === "details" && slot?.staffIds.length === 1
      ? "time"
      : steps[Math.max(0, steps.indexOf(step) - 1)];
  const cutoff = slot
    ? new Date(
        Date.parse(slot.start) - salon.changeHours * 3600000,
      ).toISOString()
    : null;
  return (
    <main className="booking-page" style={readableAccent(salon.accent)}>
      <header className="booking-top">
        <div className="salon-id">
          <Photo className="logo" src={salon.logoUrl} />
          <span>{salon.name}</span>
        </div>
        {salon.phone && (
          <a className="tel" href={"tel:" + salon.phone}>
            Ring til salonen
          </a>
        )}
      </header>
      {preview && (
        <aside className="previewbar">
          Forhåndsvisning{" "}
          <a href={"/salon?id=" + salon.id}>Tilbage til salonen</a>
        </aside>
      )}
      <div className="booking-layout">
        <aside className="identity">
          <Photo className="cover" src={salon.coverUrl} />
          <div className="identity-info">
            <span className="identity-line" />
            <h2>{salon.name}</h2>
            <p>{salon.address}</p>
            {salon.phone && <a href={"tel:" + salon.phone}>{salon.phone}</a>}
          </div>
          {service && (
            <div className="selection">
              <span>Din behandling</span>
              <b>{service.name}</b>
              <p>
                {service.durationMinutes} min.{" "}
                <span>{money(service.priceMinor)}</span>
              </p>
              {slot && (
                <p>
                  {longDate(slot.start)} kl. {clock(slot.start)}
                </p>
              )}
              {staff && <p>Hos {staff.name}</p>}
            </div>
          )}
        </aside>
        <section className="booking-body">
          <ol className="steps" aria-label="Bookingtrin">
            {steps.map((s, i) => (
              <li key={s} aria-current={s === step ? "step" : undefined}>
                <button
                  disabled={
                    sending ||
                    steps.indexOf(step) <= i ||
                    (s === "staff" && slot?.staffIds.length === 1)
                  }
                  onClick={() => {
                    setError("");
                    change(s);
                  }}
                >
                  {labels[s]}
                </button>
              </li>
            ))}
          </ol>
          <h1 ref={title} tabIndex={-1}>
            {simulated ? "Forhåndsvisning gennemført" : headings[step]}
          </h1>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {simulated ? (
            <div className="receipt">
              <p>
                Din kunde vil her få sin kvittering og sit private aftalelink.
              </p>
              <a className="primary" href={"/salon?id=" + salon.id}>
                Tilbage til salonen
              </a>
            </div>
          ) : (
            <>
              {step === "service" && (
                <>
                  <div className="services">
                    {salon.services.map((s) => (
                      <article className="service-row" key={s.id}>
                        <Photo className="service-img" src={s.photoUrl} />
                        <span className="service-copy">
                          <strong>{s.name}</strong>
                          {s.description && <span>{s.description}</span>}
                          <small>
                            {s.firstAvailableDate
                              ? "Første ledige " +
                                longDate(s.firstAvailableDate)
                              : "Ingen ledige tider"}
                          </small>
                        </span>
                        <span className="service-meta">
                          <b>{money(s.priceMinor)}</b>
                          <span>{s.durationMinutes} min.</span>
                        </span>
                        <button
                          className="service-pick"
                          aria-label={"Vælg " + s.name}
                          onClick={() => chooseService(s)}
                        >
                          Vælg
                        </button>
                      </article>
                    ))}
                  </div>
                  {!salon.services.length && (
                    <p>
                      Salonen har endnu ingen behandlinger til onlinebooking.
                    </p>
                  )}
                </>
              )}
              {step === "time" && (
                <>
                  {loadError ? (
                    <div role="alert">
                      <p>{loadError}</p>
                      <button
                        className="quiet"
                        onClick={() => {
                          setLoadError("");
                          setReload((v) => v + 1);
                        }}
                      >
                        Prøv igen
                      </button>
                    </div>
                  ) : availability ? (
                    <>
                      <Times
                        days={availability.days}
                        initialDate={viewedDate}
                        onSelect={chooseSlot}
                        onDayChange={(date) => {
                          setViewedDate(date);
                          setSlot(undefined);
                          setStaffId("");
                        }}
                      />
                      {!availability.days.length && (
                        <a href={"tel:" + salon.phone}>
                          Kontakt salonen på {salon.phone}
                        </a>
                      )}
                    </>
                  ) : (
                    <p role="status">Finder ledige tider …</p>
                  )}
                </>
              )}
              {step === "staff" && slot && (
                <>
                  <p className="intro">
                    {longDate(slot.start)} kl. {clock(slot.start)}
                  </p>
                  <div className="staff-list">
                    {salon.staff
                      .filter((s) => slot.staffIds.includes(s.id))
                      .map((s) => (
                        <button
                          key={s.id}
                          className="staff-card"
                          onClick={() => {
                            setStaffId(s.id);
                            change("details");
                          }}
                        >
                          <Photo className="portrait" src={s.photoUrl} />
                          <strong>{s.name}</strong>
                        </button>
                      ))}
                  </div>
                  <button
                    className="quiet"
                    onClick={() => {
                      setStaffId("");
                      change("details");
                    }}
                  >
                    Ingen præference
                  </button>
                </>
              )}
              {step === "details" && slot && service && (
                <form className="guest-form" onSubmit={confirm}>
                  <div className="detail-line">
                    <strong>{service.name}</strong>
                    <b>{money(service.priceMinor)}</b>
                  </div>
                  <p>
                    {longDate(slot.start)} kl. {clock(slot.start)} til{" "}
                    {clock(slot.end)}
                    <br />
                    {staff ? "Hos " + staff.name : "Første ledige frisør"}
                    <br />
                    {salon.address}
                  </p>
                  <label className="field">
                    Dit navn
                    <input
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Telefonnummer
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      minLength={6}
                      maxLength={25}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <p className="fine">
                    Du betaler i salonen.{" "}
                    {cutoff &&
                      (Date.parse(cutoff) <= selectedAt
                        ? "Tiden ligger inden for ændringsfristen. Ring til salonen, hvis du får brug for at ændre den."
                        : "Online ændringer er mulige indtil " +
                          longDate(cutoff) +
                          " kl. " +
                          clock(cutoff) +
                          ".")}{" "}
                    Gem dit private aftalelink på næste side.
                  </p>
                  <button className="primary" disabled={sending}>
                    {sending
                      ? "Booker …"
                      : preview
                        ? "Afprøv bekræftelse"
                        : "Bekræft booking"}
                  </button>
                </form>
              )}
              {step !== "service" && (
                <button
                  className="back"
                  disabled={sending}
                  onClick={() => {
                    setError("");
                    change(back);
                  }}
                >
                  Tilbage
                </button>
              )}
            </>
          )}
        </section>
      </div>
      <footer className="booking-foot">MAGS Booking</footer>
    </main>
  );
}
