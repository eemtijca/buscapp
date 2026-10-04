#!/usr/bin/env bash
# Inicializa os módulos sem backend e valida as três nuvens.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

for nuvem in aws azure gcp; do
  printf '\n[%s] validando %s\n' "$(date +%H:%M:%S)" "$nuvem"
  terraform -chdir="infra/terraform/${nuvem}" init -no-color -input=false -backend=false
  terraform -chdir="infra/terraform/${nuvem}" validate -no-color
done
