# syntax=docker/dockerfile:1

# Base fixada por digest (índice multi-arquitetura do node:24-slim) para builds reproduzíveis.
FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS base
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
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /app/apps/api/uploads \
  && chown -R node:node /app/apps/api/uploads

# A aplicação roda sem privilégios; o diretório de uploads pertence ao usuário node.
USER node

WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/api/saude').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
