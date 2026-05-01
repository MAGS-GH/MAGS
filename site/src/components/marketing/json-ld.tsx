import { siteConfig } from "@/lib/site-config";

export function JsonLdOrganization() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.legalName,
    url: siteConfig.domain,
    identifier: {
      "@type": "PropertyValue",
      name: "CVR",
      value: siteConfig.cvr,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.addressLines.slice(0, 2).join(", "),
      addressLocality: "Viborg",
      postalCode: "8800",
      addressCountry: "DK",
    },
    founder: {
      "@type": "Person",
      name: siteConfig.owner,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
