# Cloudflare Tunnel og flere tjenester

Marketing-sitet (Next.js) kører typisk på én port på VPS’en, fx `127.0.0.1:3000`. Andre repos (fx `app.*`, senere `auth.mags.dk`) kører på andre porte.

## Princip

I `cloudflared` **ingress** matcher du **hostname** til en **lokal service**:

```yaml
tunnel: <dit-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: mags.dk
    service: http://127.0.0.1:3000
  - hostname: www.mags.dk
    service: http://127.0.0.1:3000
  # Eksempel: anden app fra et andet repo
  # - hostname: app.mags.dk
  #   service: http://127.0.0.1:3001
  # - hostname: auth.mags.dk
  #   service: http://127.0.0.1:3002
  - service: http_status:404
```

DNS-poster for `mags.dk` / underdomæner peger mod tunnel som beskrevet i Cloudflares dokumentation for Zero Trust / public hostnames.

## Miljøvariabler

**Docker Compose:** `NEXT_PUBLIC_CONTACT_EMAIL` er en build-variabel til Next.js. Booking indstilles ved runtime som beskrevet i [BOOKING.md](BOOKING.md). Kun marketing har en værtsport.

**Lokal npm:** Brug `site/.env.local` som beskrevet i `site/README.md`.

## Docker

**Fra repo-roden** (samme mappe som `compose.yaml`):

```bash
docker compose up -d --build
```

Marketing lytter på `127.0.0.1:3000` som standard (`MARKETING_PORT` i `.env` kan ændre værts-porten).

Alternativt enkelt image fra `site/`:

```bash
cd site
docker build -t mags-marketing \
  --build-arg NEXT_PUBLIC_CONTACT_EMAIL="mags@mags.dk" .
docker run -p 127.0.0.1:3000:3000 mags-marketing
```

Tunnelen peger på den port, hvor marketing-containeren er mappet ud (typisk `http://127.0.0.1:3000` for `mags.dk`).
