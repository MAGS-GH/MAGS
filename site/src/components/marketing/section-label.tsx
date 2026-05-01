"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type SectionLabelProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionLabel({ children, className }: SectionLabelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/5 px-5 py-2",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {!reduceMotion ? (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.65, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : null}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-accent">
        {children}
      </span>
    </div>
  );
}
