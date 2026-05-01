import Link from "next/link";
import { Container } from "@/components/marketing/container";
import { isExternalHref, siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/#ydelser", label: "Ydelser" },
  { href: "/#om", label: "Om" },
  { href: "/virksomhed", label: "Virksomhed" },
  { href: "/#kontakt", label: "Kontakt" },
];

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.25rem]">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-foreground sm:text-xl"
        >
          {siteConfig.companyName}
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
          aria-label="Primær"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="motion-safe-transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href={siteConfig.bookingUrl}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm motion-safe-transition hover:border-accent/30 hover:shadow-md md:hidden"
          {...(isExternalHref(siteConfig.bookingUrl)
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          Book
        </Link>
        <Link
          href={siteConfig.bookingUrl}
          className="hidden rounded-xl bg-gradient-to-r from-accent to-accent-secondary px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm motion-safe-transition hover:-translate-y-0.5 hover:shadow-accent md:inline-flex"
          {...(isExternalHref(siteConfig.bookingUrl)
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          Book møde
        </Link>
      </Container>
    </header>
  );
}
