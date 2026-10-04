#!/usr/bin/env bash
# Sobe os emuladores Floci, aplica o Terraform de cada nuvem, confere a saúde da
# aplicação e destrói os recursos. Uso: infra/floci/testar.sh [aws|azure|gcp|tudo]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
export PATH="$HOME/.local/bin:$PATH"
export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

NUVEM="${1:-tudo}"
MANTER="${MANTER:-false}"
CERT_AZ="$(mktemp -t floci-az-XXXXXX.crt)"
trap 'rm -f "$CERT_AZ"' EXIT

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"; }

porta_aws="${FLOCI_AWS_PORT:-4566}"
porta_az="${FLOCI_AZ_PORT:-4577}"
porta_gcp="${FLOCI_GCP_PORT:-4588}"

subir_emuladores() {
  if curl -s -o /dev/null --max-time 3 "http://localhost:${porta_aws}/health" \
    && curl -sk -o /dev/null --max-time 3 "https://localhost:${porta_az}/health" \
    && curl -s -o /dev/null --max-time 3 "http://localhost:${porta_gcp}/health"; then
    log 'Emuladores já respondem nas portas padrão; usando as instâncias atuais.'
    return
  fi

  log 'Subindo os emuladores com docker compose.'
  docker compose -f infra/floci/compose.floci.yml up -d

  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 2 "http://localhost:${porta_aws}/health" \
      && curl -sk -o /dev/null --max-time 2 "https://localhost:${porta_az}/health" \
      && curl -s -o /dev/null --max-time 2 "http://localhost:${porta_gcp}/health"; then
      return
    fi
    sleep 2
  done

  log 'Os emuladores não responderam no tempo esperado.'
  exit 1
}

garantir_imagem() {
  if docker image inspect buscapp-api:local >/dev/null 2>&1; then
    return
  fi
  log 'Construindo a imagem buscapp-api:local.'
  docker build -f infra/docker/Dockerfile -t buscapp-api:local .
}

ip_do_conteiner() {
  docker inspect "$1" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
}

iniciar_terraform() {
  terraform -chdir="$1" init -no-color -input=false
}

testar_aws() {
  log 'Aplicando o Terraform da AWS.'
  local conteiner_floci="${FLOCI_AWS_CONTAINER:-}"
  if [ -z "$conteiner_floci" ]; then
    if docker inspect buscapp-floci-aws >/dev/null 2>&1; then
      conteiner_floci=buscapp-floci-aws
    else
      conteiner_floci=floci
    fi
  fi
  local ip_floci
  ip_floci="$(ip_do_conteiner "$conteiner_floci")"

  cat > infra/terraform/aws/terraform.tfvars.local <<EOF
modo_local         = true
ambiente           = "local"
imagem_aplicacao   = "buscapp-api:local"
habilitar_nat      = false
multi_az_banco     = false
num_nos_cache      = 1
desired_count      = 1
cpu_tarefa         = 256
memoria_tarefa     = 512
retencao_logs_dias = 1
habilitar_alarmes  = false
redis_url_local    = "redis://${ip_floci}:6379"
EOF

  iniciar_terraform infra/terraform/aws
  timeout 1800 terraform -chdir=infra/terraform/aws apply -no-color -input=false -auto-approve \
    -var-file=terraform.tfvars.local

  local alb
  alb="$(terraform -chdir=infra/terraform/aws output -raw alb_dns)"
  log "Conferindo a saúde pelo balanceador ${alb}."
  curl -s -o /dev/null --max-time 10 -H "Host: ${alb}" "http://${ip_floci}/api/saude"
  curl -s --max-time 10 -H "Host: ${alb}" "http://${ip_floci}/api/saude/pronto"

  if [ "$MANTER" != 'true' ]; then
    timeout 1800 terraform -chdir=infra/terraform/aws destroy -no-color -input=false \
      -auto-approve -var-file=terraform.tfvars.local
  fi
}

testar_azure() {
  log 'Aplicando o Terraform do Azure.'
  curl -s --max-time 10 "http://localhost:${porta_az}/_floci/tls-cert" -o "$CERT_AZ"
  export SSL_CERT_FILE="$CERT_AZ"
  local sufixo="v$(date +%s)"

  cat > infra/terraform/azure/terraform.tfvars.local <<EOF
modo_local            = true
ambiente              = "local"
imagem_aplicacao      = "buscapp-api:local"
sku_banco             = "B_Standard_B1ms"
desired_count         = 1
retencao_logs_dias    = 30
habilitar_alarmes     = false
endereco_banco_local  = null
conexao_storage_local = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://172.17.0.1:${porta_az}/devstoreaccount1;"
EOF

  iniciar_terraform infra/terraform/azure

  local alvos=(
    -target=azurerm_resource_group.principal
    -target=azurerm_storage_account.anexos
    -target=azurerm_postgresql_flexible_server.banco
    -target=azurerm_postgresql_flexible_server_database.buscapp
    -target=azurerm_postgresql_flexible_server_firewall_rule.local[0]
    -target=azurerm_container_app_environment.local[0]
  )
  timeout 1800 terraform -chdir=infra/terraform/azure apply -no-color -input=false -auto-approve \
    -var-file=terraform.tfvars.local -var="sufixo_revisao=${sufixo}" "${alvos[@]}"

  local nome_pg='buscapp-local-pg'
  local conteiner_pg
  conteiner_pg="$(docker ps --format '{{.Names}}' | grep -- "-pg-${nome_pg}" | head -1)"
  local ip_pg
  ip_pg="$(ip_do_conteiner "$conteiner_pg")"
  if [ -z "$ip_pg" ]; then
    log 'Não foi possível descobrir o endereço do PostgreSQL.'
    exit 1
  fi

  # O recurso de banco do emulador registra o ARM sem criar o banco no motor,
  # então o banco é criado aqui quando ainda não existe.
  if ! docker exec -e PGPASSWORD='BuscappLocal!2026' "$conteiner_pg" \
    psql -U buscapp_gestor -d postgres -tAc "select 1 from pg_database where datname='buscapp'" | grep -q 1; then
    log 'Criando o banco buscapp no PostgreSQL emulado.'
    docker exec -e PGPASSWORD='BuscappLocal!2026' "$conteiner_pg" createdb -U buscapp_gestor buscapp
  fi

  log 'Criando o contêiner de anexos no Blob emulado.'
  curl -sk -o /dev/null -X PUT -H 'Authorization: Bearer fake' -H 'Content-Type: application/json' \
    -d '{}' \
    "https://localhost:${porta_az}/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/buscapp-local-rg/providers/Microsoft.Storage/storageAccounts/$(terraform -chdir=infra/terraform/azure output -raw conta_storage)/blobServices/default/containers/anexos?api-version=2023-05-01" || true

  timeout 1800 terraform -chdir=infra/terraform/azure apply -no-color -input=false -auto-approve \
    -var-file=terraform.tfvars.local -var="endereco_banco_local=${ip_pg}:5432" -var="sufixo_revisao=${sufixo}"

  local fqdn
  fqdn="$(curl -sk --max-time 10 -H 'Authorization: Bearer fake' \
    "https://localhost:${porta_az}/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/buscapp-local-rg/providers/Microsoft.App/containerApps/buscapp-local-api?api-version=2024-03-01" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["properties"]["configuration"]["ingress"]["fqdn"])')"
  log "Conferindo a saúde pelo Container App ${fqdn}."
  curl -sk -o /dev/null --max-time 10 -H "Host: ${fqdn}" "https://localhost:${porta_az}/api/saude"
  curl -sk --max-time 10 -H "Host: ${fqdn}" "https://localhost:${porta_az}/api/saude/pronto"

  if [ "$MANTER" != 'true' ]; then
    timeout 1800 terraform -chdir=infra/terraform/azure destroy -no-color -input=false \
      -auto-approve -var-file=terraform.tfvars.local -var="endereco_banco_local=${ip_pg}:5432" -var="sufixo_revisao=${sufixo}"
  fi
}

testar_gcp() {
  log 'Aplicando o Terraform do GCP.'
  export GOOGLE_OAUTH_ACCESS_TOKEN=floci
  iniciar_terraform infra/terraform/gcp
  timeout 1800 terraform -chdir=infra/terraform/gcp apply -no-color -input=false -auto-approve \
    -var-file=terraform.tfvars.local

  local url
  url="$(terraform -chdir=infra/terraform/gcp output -raw url_servico_cloud_run)"
  log "Conferindo a saúde no Cloud Run ${url}."
  curl -s -o /dev/null --max-time 10 "${url}/api/saude"

  if [ "$MANTER" != 'true' ]; then
    timeout 1800 terraform -chdir=infra/terraform/gcp destroy -no-color -input=false \
      -auto-approve -var-file=terraform.tfvars.local
  fi
}

subir_emuladores
garantir_imagem

case "$NUVEM" in
  aws) testar_aws ;;
  azure) testar_azure ;;
  gcp) testar_gcp ;;
  tudo)
    testar_aws
    testar_azure
    testar_gcp
    ;;
  *)
    log "Nuvem desconhecida: ${NUVEM}. Use aws, azure, gcp ou tudo."
    exit 1
    ;;
esac

log 'Testes concluídos.'
