export const siteConfig = {
  companyName: "MAGS Solutions",
  legalName: "MAGS Solutions",
  cvr: "46436490",
  addressLines: [
    "C/O Mathias Gaardsdal Steenberg",
    "Skovgaardsvej 4 A",
    "8800 Viborg",
  ],
  nace: "621000 Computerprogrammering",
  owner: "Mathias Gaardsdal Steenberg",
  ownerShort: "Mathias Gaardsdal Steenberg",
  domain: "https://mags.dk",
  bookingUrl:
    process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || "/#kontakt",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "kontakt@mags.dk",
} as const;

export function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function mailtoHref(subject?: string) {
  const base = `mailto:${siteConfig.contactEmail}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}
