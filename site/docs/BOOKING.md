# Booking med Outlook og Teams

## Simuleret kalender

Opret en lokal `.env` ud fra roden af projektet. Brug følgende indstillinger til en udviklingsinstallation:

```dotenv
COMPOSE_PROFILES=booking
BOOKING_ENABLED=true
BOOKING_MODE=fake
BOOKING_ASPNETCORE_ENVIRONMENT=Development
BOOKING_DB_PASSWORD=dev-local
BOOKING_DATABASE_CONNECTION=Host=booking-db;Database=booking;Username=booking;Password=dev-local
```

Kør `docker compose up -d --build` og åbn [localhost:3000/booking](http://localhost:3000/booking). Den simulerede kalender bruger PostgreSQL til reservationer. Den sender ingen invitationer. Brug en særskilt database og `MAGS_NETWORK_NAME` til en eventuel delt testinstallation.

## Aktivér i produktion

1. Få en Exchange-administrator til at bekræfte, hvilken arbejdspostkasse CORE læser. Opret en særskilt single-tenant Entra-app til MAGS. Brug dens Enterprise Applications service principal object ID i Exchange sammen med appens client ID. Afgræns et Exchange management scope til arbejdspostkassens Entra-object-ID og tildel rollen `Application Calendars.ReadWrite` inden for dette scope. Undlad en tenantdækkende Graph-kalendertildeling, da rettighederne lægges sammen. [Microsofts vejledning til Exchange Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
2. Verificér med den nye apps token, at `GET /users/{mailbox}/calendar` og `calendarView` virker for arbejdspostkassen, at kalenderen understøtter `teamsForBusiness`, og at et opslag i en postkasse uden for scopet afvises. Opret et testmøde fra arbejdspostkassen til en aftalt ekstern testadresse. Bekræft, at Outlook leverer invitationen og gæsten kan åbne Teams-linket. Aflys derefter testen fra Outlook. [Teams-møder i Outlook](https://learn.microsoft.com/en-us/graph/outlook-calendar-online-meetings)
3. Opret en managed Turnstile-widget til `mags.dk` og `www.mags.dk`. Indtast sitekey og secret i Dokploy, og hold `TURNSTILE_HOSTNAMES` i overensstemmelse med de domæner, der serverer formularen. Next.js leverer kun sitekey til browseren. API'et kontrollerer både domæne og handlingen `booking`. [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
4. Sæt `COMPOSE_PROFILES=booking`, `BOOKING_MODE=graph`, `BOOKING_ASPNETCORE_ENVIRONMENT=Production`, `BOOKING_TENANT_ID`, `BOOKING_CLIENT_ID`, `BOOKING_CLIENT_SECRET` og `BOOKING_MAILBOX` i Dokploy. Sæt en stærk `BOOKING_DB_PASSWORD` og en tilsvarende `BOOKING_DATABASE_CONNECTION` med host `booking-db`, database `booking` og bruger `booking`. Sæt `BOOKING_REQUEST_HASH_KEY` til en stabil, separat hemmelighed på mindst 32 tegn. Læg alle hemmeligheder i Dokploy.
5. Sæt `BOOKING_ENABLED=true` efter test af Outlook. Genudrul og tjek `/booking`, de ledige tider og Turnstile på det offentlige domæne. Luk for nye bookinger ved at sætte `BOOKING_ENABLED=false` og genudrulle. Aftaler kan stadig administreres i Outlook.

API'et læser den konfigurerede standardkalender og sender kun ledige tider til browseren. Et udfald i Graph eller PostgreSQL lukker for nye reservationer. Hvis et Graph-kald kan have oprettet et møde uden at returnere et svar, holder tjenesten tiden tilbage, indtil den kan afstemme med Outlook. Ved vedvarende afventende reservation kontrolleres arbejdskalenderen manuelt. Flyt eller aflys bekræftede møder fra Outlook, så gæsten får opdateringen. Hold PostgreSQL-disken og adgang til dens backup under samme drift som øvrige Dokploy-data.
