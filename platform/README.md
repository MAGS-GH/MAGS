# MAGS Booking

Platformen er en selvstændig tjeneste til én adresse pr. salon. I MAGS-administrationen oprettes en kladde og en invitation til ejeren. Ejeren tilføjer medarbejdere, vagter og behandlinger under Salon, prøver forhåndsvisningen og åbner for onlinebooking. En pauseret salon beholder adgang til reception og eksisterende aftaler. Kunder betaler i salonen. Der er ingen udgående mail- eller SMS-integration.

## Indgange

| Adresse | Brug |
| --- | --- |
| `/admin` | MAGS’ salonliste og ejerinvitationer |
| `/salon` | Kalender, kunder og opsætning efter rolle |
| `/s/{slug}` | Kundens bookingside |
| `/invitation#token=…` | Indløs engangsinvitation efter login |
| `/aftale#…` | Privat kvittering, kalenderfil, flytning og aflysning |

Opret aldrig kodeord i salonens administration. Medlemskab følger Mercantec Auth-brugerens stabile `sub`. De første MAGS-administratorer sættes som GUID'er i `SALON_ADMIN_SUBJECTS`. Hver salon bestemmer sine egne bookbare tider, priser i danske kroner og ændringsfrist. Et tabt kundelink håndteres ved at ringe til salonens reception. Alle tidspunkter på skærmen følger Europe/Copenhagen.

## Docker og login

Kopiér `platform/.env.example` til `platform/.env`. Generér en lang tilfældig databaseadgangskode og en separat, stabil nøgle på 32 bytes i base64 til `SALON_LINK_KEY`. Gem en sikker kopi af nøglen sammen med driftskonfigurationen. Platformen hasher aftalelinks i databasen og bruger nøglen ved sikre genforsøg. Registrér en offentlig PKCE-klient i Mercantec Auth med den præcise callback `https://book.mags.dk/auth/callback` og godkend web-origin. For lokal drift anvendes en separat klient med callback på lokalporten.

Kør fra `platform/` med Compose v2.24.4 eller nyere:

```sh
docker compose -f compose.yaml -f compose.local.yaml up -d --build
```

Åbn `http://localhost:3970`. Til en isoleret udviklerprøve af login findes en lokal signeret OIDC-testudsteder i `api/tests/local-issuer.mjs`. Brug den kun med en særskilt testdatabase og et lokalt API. Produktion verificerer signatur, udsteder, audience og stabilt bruger-id hos Mercantec Auth.

## Produktion og gendannelse

Dokploy-tjenesten **MAGS Booking** bruger `main`, `./platform/compose.yaml` og env fra Dokploy. Cloudflare sender book.mags.dk til Traefik. Kun salon-web ligger på dokploy-network. Web sender API-kald over det private Compose-netværk. Hold private links, persondata og tokens ude af proxylogning og overvågning. Brug `GET /health` på det interne API til at kontrollere databaseforbindelsen.

Tag en PostgreSQL-backup før skemaopgraderinger. Migrationer køres transaktionelt ved start. Kontrollér den daglige Dokploy-backup, og prøv en gendannelse i en separat database, før en backup bruges til driftsgendannelse. Eksempel med PostgreSQLs egne værktøjer og separat, tom gendannelsesdatabase:

```sh
pg_dump --format=custom --no-owner --file=salon.dump "$SOURCE_DATABASE_URL"
pg_restore --exit-on-error --no-owner --dbname="$EMPTY_RESTORE_DATABASE_URL" salon.dump
```

Kontrollér antallet af saloner, medarbejdere, aftaler og optagede intervaller, og hent en kendt testkvittering fra den gendannede installation med samme linknøgle. Behandl dump og eksporter som kundedata. Ved rollback bruges den tidligere kompatible appversion. En gendannelse, der overskriver aktive kundedata, kræver en separat driftsbeslutning.

## Afprøvning

Kør `npm ci`, `npm run lint`, `npm run typecheck` og `npm run build` i `web/`. Byg API med `dotnet build api/SalonPlatform.csproj` fra `platform/`. Testene under `api/tests` bruger en disponibel PostgreSQL-database. Eksempel på browserprøve fra `platform/web/`:

```sh
npx playwright install chromium
node tests/guest-flow.mjs http://localhost:3970 qa-proeve
```

Opret en særlig prøvesalon med dette slug, to frisører som kan udføre samme ydelse og mindst fem bookbare dage. Prøven opretter, flytter og aflyser syntetiske aftaler på desktop og mobil og kontrollerer kalenderfilen. Salgsdemoen på mags.dk er fortsat en separat, fiktiv oplevelse.
