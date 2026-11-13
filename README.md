# MAGS Solutions

Hjemmesiden på [mags.dk](https://mags.dk/) viser MAGS' ydelser med et scrollstyret Three.js-eksempel. Next.js i `site/` serverer forsiden og `/booking`. Den private .NET 10-tjeneste i `api/` beregner ledige tider og opretter Teams-møder gennem Microsoft Graph. PostgreSQL holder styr på samtidige forsøg og genforsøg.

## Kør lokalt

```sh
docker compose up -d --build
```

Åbn [localhost:3000](http://localhost:3000/). Med standardindstillingerne viser booking mail som kontaktvej. [Bookingvejledningen](site/docs/BOOKING.md) viser, hvordan hele flowet testes med en simuleret kalender.

Til arbejde på forsiden uden Docker kan du køre `npm ci` og `npm run dev` i `site/`. Opdatér både `package-lock.json` og `bun.lock`, når afhængighederne ændres.

## Produktion

Dokploys **MAGS Homepage** følger `main` og bruger `compose.yaml`. Cloudflare Tunnel peger på marketingsidens lokale port. API og PostgreSQL har ingen værtsporte. Se [tunnelopsætningen](site/docs/CLOUDFLARE-TUNNEL.md) og [aktivering af Outlook-booking](site/docs/BOOKING.md).

**MAGS Solutions** · CVR 46436490 · enkeltmandsvirksomhed.
