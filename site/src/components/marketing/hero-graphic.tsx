"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function HeroGraphic({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative hidden min-h-[420px] select-none lg:block lg:min-h-[480px]",
        className,
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent/[0.08] via-transparent to-accent-secondary/[0.06]" />
      <div className="absolute -right-8 top-8 h-72 w-72 rounded-full bg-accent/[0.06] blur-[150px]" />
      <div className="absolute -left-12 bottom-0 h-64 w-64 rounded-full bg-accent-secondary/[0.08] blur-[150px]" />

      <div className="relative flex h-full items-center justify-center p-8">
        {!reduceMotion ? (
          <motion.div
            className="absolute inset-10 rounded-full border border-dashed border-accent/25"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <div className="absolute inset-10 rounded-full border border-dashed border-accent/25" />
        )}

        <div className="relative grid grid-cols-3 gap-3 opacity-90">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-accent/20"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>

        {!reduceMotion ? (
          <>
            <motion.div
              className="absolute right-[12%] top-[18%] w-[44%] rounded-2xl border border-border bg-card p-4 shadow-xl"
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="h-2 w-1/3 rounded-full bg-gradient-to-r from-accent to-accent-secondary" />
              <div className="mt-3 space-y-2">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-4/5 rounded bg-muted" />
              </div>
            </motion.div>
            <motion.div
              className="absolute bottom-[20%] left-[8%] w-[38%] rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm"
              animate={{ y: [0, 10, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-secondary text-xs font-bold text-accent-foreground shadow-accent">
                  TS
                </span>
                <div className="flex-1 space-y-2">
                  <div className="h-2 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          <>
            <div className="absolute right-[12%] top-[18%] w-[44%] rounded-2xl border border-border bg-card p-4 shadow-xl">
              <div className="h-2 w-1/3 rounded-full bg-gradient-to-r from-accent to-accent-secondary" />
            </div>
            <div className="absolute bottom-[20%] left-[8%] w-[38%] rounded-2xl border border-border bg-card p-4 shadow-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-secondary text-xs font-bold text-accent-foreground">
                TS
              </span>
            </div>
          </>
        )}

        <div className="absolute right-[6%] bottom-[8%] h-16 w-16 rounded-2xl bg-accent shadow-accent-lg" />
      </div>
    </div>
  );
}
