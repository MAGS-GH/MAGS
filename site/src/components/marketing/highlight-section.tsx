"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/marketing/container";
import { Section } from "@/components/marketing/section";
import { SectionLabel } from "@/components/marketing/section-label";
import { fadeInUp, stagger, viewportOnce } from "@/lib/motion";
import { isExternalHref, mailtoHref, siteConfig } from "@/lib/site-config";

const stats = [
  { label: "Fokus", value: "TypeScript" },
  { label: "Leverance", value: "Iterationer" },
  { label: "Drift", value: "VPS + tunnel" },
  { label: "Partner", value: "Tæt dialog" },
];

export function HighlightSection() {
  const reduceMotion = useReducedMotion();

  return (
    <Section className="relative overflow-hidden bg-foreground text-background">
      <div
        className="pointer-events-none absolute inset-0 dot-pattern opacity-[0.03]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-accent/[0.06] blur-[150px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-accent-secondary/[0.07] blur-[150px]" />

      <Container className="relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
          className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20"
        >
          <div>
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-2">
                <span className="relative flex h-2 w-2">
                  {!reduceMotion ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
                  ) : null}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-accent-secondary">
                  Sådan arbejder vi
                </span>
              </div>
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="mt-8 font-display text-3xl leading-[1.15] sm:text-[3.25rem]"
            >
              Klar kommunikation.{" "}
              <span className="bg-gradient-to-r from-accent-secondary to-accent bg-clip-text text-transparent">
                Skarp eksekvering.
              </span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="mt-6 max-w-xl text-lg leading-relaxed text-white/80"
            >
              Jeg arbejder bedst som forlængelse af dit team: små beslutningsrunder,
              dokumenterede snitflader og leverancer du kan tage i brug — ikke
              endeløse statusmøder.
            </motion.p>
            <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap gap-4">
              <Button asChild className="w-full sm:w-auto">
                <Link
                  href={siteConfig.bookingUrl}
                  {...(isExternalHref(siteConfig.bookingUrl)
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  Reservér tid
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full border-white/25 bg-transparent text-background hover:bg-white/10 hover:text-background sm:w-auto">
                <Link href={mailtoHref("Forespørgsel fra mags.dk")}>
                  Skriv en mail
                </Link>
              </Button>
            </motion.div>
          </div>

          <motion.div
            variants={fadeInUp}
            className="grid grid-cols-2 gap-4 sm:gap-5 lg:gap-6"
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8"
                style={{ transform: i === 1 ? "translateY(12px)" : undefined }}
              >
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/50">
                  {s.label}
                </p>
                <p className="mt-3 font-display text-2xl text-white sm:text-3xl">
                  {s.value}
                </p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </Container>
    </Section>
  );
}
