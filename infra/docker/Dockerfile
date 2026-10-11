# syntax=docker/dockerfile:1

# Base fixada por digest (índice multi-arquitetura do node:24-slim) para builds reproduzíveis.
FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS base
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contratos/package.json packages/contratos/package.json
# O estágio de build executa os builds necessários explicitamente; scripts de instalação
# não têm as fontes disponíveis nesta camada.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm --filter @buscapp/contratos run build \
  && pnpm --filter @buscapp/web run build \
  && pnpm --filter @buscapp/api run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contratos/package.json packages/contratos/package.json
# `--ignore-scripts` bloqueia scripts de instalação; em seguida, `pnpm rebuild --pending`
# executa os scripts autorizados que faltam (o schema engine do Prisma usado pelo
# entrypoint em `prisma migrate deploy`).
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
  && pnpm rebuild --pending \
  && chown -R node:node node_modules apps/api/node_modules apps/web/node_modules packages/contratos/node_modules

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
