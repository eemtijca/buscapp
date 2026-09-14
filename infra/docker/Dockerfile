# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contratos/package.json packages/contratos/package.json
# O estágio de build executa os builds necessários explicitamente; scripts de instalação
# não têm as fontes disponíveis nesta camada.
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
RUN npm run build -w @buscapp/contratos && npm run build -w @buscapp/web && npm run build -w @buscapp/api

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contratos/package.json packages/contratos/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages/contratos/dist packages/contratos/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY infra/docker/role.mjs apps/api/role.mjs
COPY infra/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
