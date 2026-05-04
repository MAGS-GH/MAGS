# Docker build fejlsøgning

## Hvordan afhængigheder installeres

**Bun** (`oven/bun`) installerer fra **`bun.lock`** i et separat build-trin. Det undgår typisk **npm**-fejlen *Exit handler never called* og lange/hængende `npm ci`-kørsler under **Docker Desktop på Windows**.

Når du ændrer `package.json` / npm-afhængigheder lokalt: kør i `site/`:

```bash
npm install
bun install
```

…så `package-lock.json` og **`bun.lock`** matcher (commit begge).

## Første build tager lang tid

Første gang hentes **`oven/bun`**- og **`node`**-images plus alle pakker — **10–20 minutter** på langsom forbindelse er ikke unormalt. Senere builds er hurtigere (BuildKit **bun-cache**).

## Cursor / IDE-task stopper med exit 1 efter ~1 minut

Nogle editor-tasks **afbryder** lange Docker-builds. Kør i stedet i en almindelig terminal:

```bash
docker compose build --progress=plain marketing
docker compose up -d
```

## `npm error Exit handler never called` (kun hvis du bygger med npm i Docker)

Ikke længere standard i dette repo (Bun bruges til install). Hvis du skifter Dockerfile tilbage til `npm ci`: se gamle noter om fetch-retries og DNS nedenfor.

## `ConnectionRefused` / `FailedToOpenSocket` eller `EAI_AGAIN` mod registry

Typisk under **`bun install`** eller **`npm ci`**: **ConnectionRefused downloading tarball …**, **FailedToOpenSocket**, eller **getaddrinfo EAI_AGAIN**. Det betyder at build-containeren **ikke får stabil forbindelse til registry.npmjs.org** (DNS, firewall, VPN, proxy eller ustabil linje). Det er **miljø-/netværksproblem**, ikke applikationskode.

**Hvis install kører i mange timer:** afbryd (`Ctrl+C`), ret netværk, byg igen — undgå at lade den gentage fejl i timevis.

Prøv i rækkefølge:

1. **Docker Desktop → Settings → Docker Engine** — merge med din eksisterende JSON og tilføj evt.:

   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1"]
   }
   ```

   Gem og **Restart** Docker.

2. Slå **VPN** fra midlertidigt, eller undtag **Docker Desktop**.

3. **Windows Firewall**: tillad **Docker Desktop** / backend-processen.

4. **Corporate netværk / proxy**: konfigurer proxy i Docker Desktop eller npm-registry hos IT.

5. Byg fra **WSL2**-terminal hvis Docker på Windows netop fejler udadgående trafik.

## Mere log

```bash
docker compose build --progress=plain --no-cache marketing
```

## Ren build-cache (hvis mistanke om korrupt cache)

```bash
docker builder prune -f
docker compose build --no-cache marketing
```
