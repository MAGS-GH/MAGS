"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/marketing/container";
import { HeroGraphic } from "@/components/marketing/hero-graphic";
import { SectionLabel } from "@/components/marketing/section-label";
import { fadeInUp, stagger, viewportOnce } from "@/lib/motion";
import { isExternalHref, mailtoHref, siteConfig } from "@/lib/site-config";

function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="motion-safe-transition group-hover:translate-x-1"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-14 lg:pb-28 lg:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,82,255,0.08),transparent_55%)]" />
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={stagger}
            className="relative z-10"
          >
            <motion.div variants={fadeInUp}>
              <SectionLabel>MAGS Solutions</SectionLabel>
            </motion.div>
            <motion.h1
              variants={fadeInUp}
              className="mt-8 font-display text-[2.75rem] font-normal leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl lg:text-[5.25rem]"
            >
              Platforme der{" "}
              <span className="gradient-text relative inline-block">
                lever
                <span
                  className="pointer-events-none absolute -bottom-1 left-0 h-3 w-full rounded-sm bg-gradient-to-r from-accent/15 to-accent-secondary/10 sm:-bottom-2 sm:h-4"
                  aria-hidden
                />
              </span>
              <br />
              i drift — ikke kun i kode.
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              Jeg bygger og driver software med tydelige mål: hurtigere
              leverancer, stabil drift og en arkitektur der kan vokse med din
              forretning.
            </motion.p>
            <motion.div
              variants={fadeInUp}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Button asChild className="group w-full sm:w-auto">
                <Link
                  href={siteConfig.bookingUrl}
                  {...(isExternalHref(siteConfig.bookingUrl)
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  Book et intro-møde
                  <ArrowIcon />
                </Link>
              </Button>
              <Button variant="outline" asChild className="group w-full sm:w-auto">
                <Link href={mailtoHref("Henvendelse fra mags.dk")}>
                  Skriv på mail
                  <ArrowIcon />
                </Link>
              </Button>
            </motion.div>
            <motion.p
              variants={fadeInUp}
              className="mt-8 text-sm text-muted-foreground"
            >
              Leveret af{" "}
              <span className="font-medium text-foreground">
                {siteConfig.ownerShort}
              </span>
              {" — computerprogrammering."}
            </motion.p>
          </motion.div>
          <HeroGraphic />
        </div>
      </Container>
    </section>
  );
}
