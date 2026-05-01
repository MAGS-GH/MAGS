"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/marketing/container";
import { Section } from "@/components/marketing/section";
import { SectionLabel } from "@/components/marketing/section-label";
import { fadeInUp, stagger, viewportOnce } from "@/lib/motion";
import { isExternalHref, mailtoHref, siteConfig } from "@/lib/site-config";

export function ContactSection() {
  return (
    <Section id="kontakt" className="scroll-mt-24 pb-28 sm:pb-36">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
          className="rounded-3xl border border-border bg-card p-8 shadow-lg sm:p-12 lg:p-16"
        >
          <motion.div variants={fadeInUp}>
            <SectionLabel>Kontakt</SectionLabel>
          </motion.div>
          <motion.h2
            variants={fadeInUp}
            className="mt-6 max-w-2xl font-display text-3xl leading-[1.15] text-foreground sm:text-[3.25rem]"
          >
            Lad os tage en{" "}
            <span className="gradient-text">uforpligtende snak</span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
          >
            Fortæl kort om mål, tidslinje og evt. eksisterende systemer — så
            finder vi den bedste indgang.
          </motion.p>
          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <Button asChild className="w-full sm:w-auto">
              <Link
                href={siteConfig.bookingUrl}
                {...(isExternalHref(siteConfig.bookingUrl)
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                Book tid i kalenderen
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href={mailtoHref("Henvendelse fra mags.dk")}>
                {siteConfig.contactEmail}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </Container>
    </Section>
  );
}
