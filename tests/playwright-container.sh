#!/bin/bash
# Roda o Playwright na imagem oficial da Microsoft com o aplicativo já no ar.

set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
IMAGEM="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.63.0-noble}"
REDE="${PLAYWRIGHT_DOCKER_NETWORK:-host}"
USUARIO="${PLAYWRIGHT_DOCKER_USER:-$(id -u):$(id -g)}"
BASE_URL="${TEST_BASE_URL:-http://localhost:5173}"
BANCO_ADMIN="${DATABASE_URL_ADMIN:-postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp}"
SENHA_ADMIN="${SEED_SENHA_ADMIN:-Admin123!}"
SENHA_PROF="${SEED_SENHA_PROF:-Prof123!}"
SENHA_RESP="${SEED_SENHA_RESP:-Resp123!}"

exec docker run --rm --init --ipc=host --network "$REDE" \
  --user "$USUARIO" \
  -e HOME=/tmp \
  -v "$RAIZ":/work \
  -w /work \
  -e TEST_BASE_URL="$BASE_URL" \
  -e PLAYWRIGHT_SKIP_WEBSERVER=1 \
  -e DATABASE_URL_ADMIN="$BANCO_ADMIN" \
  -e SEED_SENHA_ADMIN="$SENHA_ADMIN" \
  -e SEED_SENHA_PROF="$SENHA_PROF" \
  -e SEED_SENHA_RESP="$SENHA_RESP" \
  "$IMAGEM" \
  npx playwright test "$@"
