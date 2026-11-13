export function readBookingConfig() {
  const apiUrl = process.env.BOOKING_API_URL?.trim();
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const mode = process.env.BOOKING_MODE?.trim().toLowerCase();
  const fake = mode === "fake";

  if (process.env.BOOKING_ENABLED !== "true" || !apiUrl || (!fake && (mode !== "graph" || !siteKey))) {
    return null;
  }

  try {
    const baseUrl = new URL(apiUrl);
    if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      return null;
    }

    return { baseUrl, siteKey, fake };
  } catch {
    return null;
  }
}
