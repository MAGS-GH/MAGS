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
    process.env.NEXT_PUBLIC_BOOKING_URL?.trim() ||
    "https://outlook.office.com/bookwithme/user/9a9e8710d7c6494aa42d73acc2df23e3@mercantec.dk/meetingtype/paJy7mYI00yTQDysZnC53A2?bookingcode=4c756300-84ef-428f-b322-b3f602dfe8f7&anonymous&ismsaljsauthenabled&ep=mlink",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "mags@mercantec.dk",
} as const;

export function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export function mailtoHref(subject?: string) {
  const base = `mailto:${siteConfig.contactEmail}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}
