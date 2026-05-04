# mags-site

Marketingweb for **mags.dk** (Next.js + TypeScript + Tailwind).

Se repo-roden for overblik: [../README.md](../README.md).

## Scripts

- `npm run dev` — udvikling
- `npm run build` / `npm run start` — produktion
- `npm run lint` — ESLint

## Miljø

Kopier `.env.example` til `.env.local` og sæt booking-URL og e-mail.

**Docker:** Afhængigheder i image installeres med **Bun** fra `bun.lock`. Efter `npm install` lokalt, kør `bun install` i `site/` så `bun.lock` matcher (eller kun `bun install` hvis du bruger Bun overalt).

## Deploy

**Produktion:** Brug Docker Compose i repo-roden — se [../README.md](../README.md) og [docs/CLOUDFLARE-TUNNEL.md](docs/CLOUDFLARE-TUNNEL.md). Ved build-fejl: [docs/DOCKER-BUILD.md](docs/DOCKER-BUILD.md).
