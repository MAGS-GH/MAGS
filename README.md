# MAGS

Hjemmeside og marketing for **mags.dk** (MAGS Solutions).

## Struktur

- **`site/`** — Next.js 16 (App Router, TypeScript, Tailwind CSS 4), marketing-indhold og design system.

Repo-roden hedder `MAGS` (stort), så selve appen ligger i `site/` for at overholde npm’s krav om små bogstaver i `package.json`-navnet.

## Kom i gang

```bash
cd site
cp .env.example .env.local
# Udfyld NEXT_PUBLIC_BOOKING_URL og NEXT_PUBLIC_CONTACT_EMAIL
npm install
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000).

## Produktion (Docker Compose)

Alle services kører via **Compose** i roden:

```bash
cp .env.example .env
# Udfyld NEXT_PUBLIC_* i .env — de indgår i Next.js-build
docker compose up -d --build
```

Marketing: [http://localhost:3000](http://localhost:3000) (eller den port du sætter i `MARKETING_PORT`).

Fejler `docker compose build` med npm- eller DNS-fejl? Se [site/docs/DOCKER-BUILD.md](site/docs/DOCKER-BUILD.md).

Flere containere (fx `app.mags.dk`, `auth.mags.dk`) tilføjes som nye `services:` i [`compose.yaml`](compose.yaml) med samme `mags_net`-netværk. Se [site/docs/CLOUDFLARE-TUNNEL.md](site/docs/CLOUDFLARE-TUNNEL.md) for tunnel → localhost-porte.

Lokal udvikling uden Docker: `cd site && npm run dev` som før.

## Virksomhed

**MAGS Solutions** · CVR 46436490 · enkeltmandsvirksomhed · NACE 621000.
