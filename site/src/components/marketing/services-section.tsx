"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/marketing/container";
import { Section } from "@/components/marketing/section";
import { SectionLabel } from "@/components/marketing/section-label";
import { fadeInUp, stagger, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";

const items = [
  {
    title: "Platforme & produkter",
    description:
      "Fra idé til produktion: API’er, admin-flader, integrationer og en arkitektur der tåler skala og ændringer.",
    featured: true,
  },
  {
    title: "Webapps & sites",
    description:
      "Hurtige, tilgængelige weboplevelser med TypeScript — fra landingssider til komplekse kundeportaler.",
    featured: false,
  },
  {
    title: "Drift & hosting",
    description:
      "Ofte på egen VPS: deploy, overvågning, backups og tunnel/DNS — så du slipper for “det virker på min maskine”.",
    featured: false,
  },
];

export function ServicesSection() {
  return (
    <Section id="ydelser" className="scroll-mt-24">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
        >
          <motion.div variants={fadeInUp}>
            <SectionLabel>Ydelser</SectionLabel>
          </motion.div>
          <motion.h2
            variants={fadeInUp}
            className="mt-6 max-w-3xl font-display text-3xl leading-[1.15] text-foreground sm:text-[3.25rem]"
          >
            Én partner til{" "}
            <span className="gradient-text">udvikling og drift</span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
          >
            Typiske forløb starter med afklaring og en skarp snitflade — derefter
            bygger vi i iterationer, så du ser fremskridt tidligt og ofte.
          </motion.p>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {items.map((item, index) => (
              <motion.div
                key={item.title}
                variants={fadeInUp}
                className={cn(index === 0 && "lg:col-span-2 lg:max-w-none")}
              >
                {item.featured ? (
                  <div className="rounded-2xl bg-gradient-to-br from-accent via-accent-secondary to-accent p-[2px] shadow-accent">
                    <Card className="h-full rounded-[calc(1rem-2px)] border-0 shadow-none motion-safe-transition hover:shadow-xl">
                      <CardHeader className="gap-4">
                        <CardTitle>{item.title}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                ) : (
                  <Card className="group relative h-full overflow-hidden motion-safe-transition hover:-translate-y-0.5 hover:shadow-xl">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/[0.03] to-transparent opacity-0 motion-safe-transition group-hover:opacity-100" />
                    <CardHeader className="relative gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-secondary text-accent-foreground shadow-accent motion-safe-transition group-hover:scale-110">
                        <span className="text-sm font-bold">
                          {index === 1 ? "W" : "∞"}
                        </span>
                      </div>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Container>
    </Section>
  );
}
