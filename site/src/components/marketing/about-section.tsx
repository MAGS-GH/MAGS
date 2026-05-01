"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "@/components/marketing/container";
import { Section } from "@/components/marketing/section";
import { SectionLabel } from "@/components/marketing/section-label";
import { fadeInUp, stagger, viewportOnce } from "@/lib/motion";
import { siteConfig } from "@/lib/site-config";

export function AboutSection() {
  return (
    <Section id="om" className="scroll-mt-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={stagger}
          >
            <motion.div variants={fadeInUp}>
              <SectionLabel>Bag brandet</SectionLabel>
            </motion.div>
            <motion.h2
              variants={fadeInUp}
              className="mt-6 font-display text-3xl leading-[1.15] text-foreground sm:text-[3.25rem]"
            >
              {siteConfig.ownerShort.split(" ")[0]}{" "}
              <span className="gradient-text">bygger</span> —{" "}
              {siteConfig.companyName} leverer.
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="mt-6 text-lg leading-relaxed text-muted-foreground"
            >
              Jeg hedder {siteConfig.ownerShort} og driver{" "}
              {siteConfig.companyName} som enkeltmandsvirksomhed. Du får den
              korte vej til beslutninger: én ansvarlig udvikler, tydelige
              forventninger og løsninger der er skabt til drift.
            </motion.p>
            <motion.p
              variants={fadeInUp}
              className="mt-4 text-lg leading-relaxed text-muted-foreground"
            >
              Er du nysgerrig på formalia og CVR, finder du det samlet på{" "}
              <Link
                href="/virksomhed"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                virksomhedssiden
              </Link>
              .
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeInUp}
            className="rounded-tl-[4rem] rounded-br-[4rem] border border-border bg-card p-8 shadow-lg sm:p-10 lg:mt-8"
          >
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
              Kort sagt
            </p>
            <ul className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">
                  Teknologi:
                </span>{" "}
                TypeScript-first, moderne webstack, sunde defaults for sikkerhed
                og performance.
              </li>
              <li>
                <span className="font-semibold text-foreground">Drift:</span>{" "}
                Typisk på egen infrastruktur med tunnel og DNS sat fornuftigt op.
              </li>
              <li>
                <span className="font-semibold text-foreground">Samarbejde:</span>{" "}
                Fast rytme, små releases, og ingen “black box”.
              </li>
            </ul>
          </motion.div>
        </div>
      </Container>
    </Section>
  );
}
