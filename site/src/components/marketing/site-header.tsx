"use client";

import Link from "next/link";
import { useRef } from "react";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/#ydelser", label: "Ydelser" },
  { href: "/#samarbejde", label: "Sådan arbejder jeg" },
  { href: "/#om", label: "Om" },
];

export function SiteHeader({ className }: { className?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <header className={cn("site-header", className)}>
      <div className="editorial-shell site-header-inner">
        <Link className="site-wordmark" href="/">{siteConfig.companyName}</Link>
        <nav aria-label="Primær" className="desktop-nav">
          {navigation.map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <details className="mobile-nav" ref={menu} onKeyDown={(event) => {
            if (event.key === "Escape" && menu.current?.open) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }}>
            <summary>Menu</summary>
            <nav aria-label="Primær">
              {[...navigation, { href: "/virksomhed", label: "Virksomhedsoplysninger" }].map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => { if (menu.current) menu.current.open = false; }}>
                  {label}
                </Link>
              ))}
            </nav>
          </details>
          <Link className="primary-action header-book" href={siteConfig.bookingUrl}>
            <span className="header-book-full">Book et gratis intromøde</span>
            <span className="header-book-short">Book møde</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
