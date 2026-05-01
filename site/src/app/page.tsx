import { AboutSection } from "@/components/marketing/about-section";
import { ContactSection } from "@/components/marketing/contact-section";
import { Hero } from "@/components/marketing/hero";
import { HighlightSection } from "@/components/marketing/highlight-section";
import { ServicesSection } from "@/components/marketing/services-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ServicesSection />
        <HighlightSection />
        <AboutSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
