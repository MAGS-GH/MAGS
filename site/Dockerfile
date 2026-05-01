# npm ci i Docker Desktop (Windows) fejler ofte ("Exit handler never called") eller hænger længe.
# Bun installerer fra package-lock.json hurtigt og stabilt; Node bruges kun til `next build` + runtime.

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Bruger eksisterende npm lockfile; ingen bun.lock nødvendig
RUN bun install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_BOOKING_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL
ENV NEXT_PUBLIC_BOOKING_URL=$NEXT_PUBLIC_BOOKING_URL
ENV NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
