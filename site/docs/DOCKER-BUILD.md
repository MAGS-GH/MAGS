# Docker build fejlsøgning

## Første build tager lang tid

Trin **`npm ci (forsøg 1/6)`** kan godt køre **5–15 minutter** første gang (mange pakker + download). Det er normalt. Efterfølgende builds er hurtigere takket være BuildKit **npm-cache** i Dockerfile.

## `npm error Exit handler never called`

Ses ofte med **npm 10** under **Docker Desktop** (især Windows), især ved lange installs. Dockerfile’en gentager `npm ci` op til 6 gange med stigende pause — det løser mange midlertidige fejl.

Hvis det fortsætter: giv Docker **mere RAM** (Settings → Resources) og prøv igen.

## `EAI_AGAIN` / `getaddrinfo` mod registry.npmjs.org

Build-containeren kan ikke slå DNS op eller nå npm-registry.

1. **Docker Desktop → Settings → Docker Engine** — tilføj f.eks.:

   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1"]
   }
   ```

   Gem og **Restart** Docker.

2. Slå **VPN** midlertidigt fra, eller tilføj undtagelse for Docker.

3. På corporate netværk: bekræft at proxy ikke blokerer `registry.npmjs.org`.

## Mere log

```bash
docker compose build --progress=plain --no-cache marketing
```

## Ren build-cache (hvis mistanke om korrupt cache)

```bash
docker builder prune -f
docker compose build --no-cache marketing
```
