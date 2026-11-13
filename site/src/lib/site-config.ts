export const siteConfig = {
  companyName: "MAGS Solutions",
  legalName: "MAGS Solutions",
  cvr: "46436490",
  owner: "Mathias Gaardsdal Steenberg",
  ownerShort: "Mathias Gaardsdal Steenberg",
  domain: "https://mags.dk",
  bookingUrl: "/booking",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "mags@mags.dk",
} as const;

export function mailtoHref(subject?: string) {
  const base = `mailto:${siteConfig.contactEmail}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}
