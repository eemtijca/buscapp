# Dados derivados e nomes padronizados dos recursos Azure.

resource "random_string" "sufixo" {
  length  = 4
  upper   = false
  special = false
  numeric = true
}

locals {
  nome_base = "${var.nome_aplicacao}-${var.ambiente}"

  nome_container_anexos = "anexos"

  # No modo local o endereço do PostgreSQL costuma ser o gateway do Docker com
  # a porta publicada; o nome devolvido pelo emulador não resolve na bridge.
  endereco_banco_local = var.endereco_banco_local != null ? var.endereco_banco_local : azurerm_postgresql_flexible_server.banco.fqdn

  nome_curto = lower(replace("${var.nome_aplicacao}${var.ambiente}", "-", ""))

  nome_storage = substr("${local.nome_curto}${random_string.sufixo.result}", 0, 24)

  nome_acr = lower(replace("${local.nome_curto}acr", "-", ""))

  nome_kv = substr("${local.nome_base}-kv", 0, 24)

  tags = {
    Aplicacao     = var.nome_aplicacao
    Ambiente      = var.ambiente
    GerenciadoPor = "terraform"
  }

  # No modo local o firewal do emulador não tem efeito prático.
  permitir_rede_publica_banco = var.modo_local ? true : !var.habilitar_rede_privada

  retencao_backup = var.modo_local ? 7 : var.retencao_backup_dias

  url_banco_producao = format(
    "postgresql://%s:%s@%s:5432/buscapp?sslmode=require",
    "buscapp_gestor",
    ephemeral.random_password.banco.result,
    azurerm_postgresql_flexible_server.banco.fqdn,
  )

  url_banco_local = format(
    "postgresql://%s:%s@%s/buscapp",
    "buscapp_gestor",
    var.senha_banco_local,
    local.endereco_banco_local,
  )

  url_migracao_producao = local.url_banco_producao

  url_aplicacao_banco_producao = format(
    "postgresql://%s:%s@%s:5432/buscapp?sslmode=require",
    "buscapp_api",
    ephemeral.random_password.app.result,
    azurerm_postgresql_flexible_server.banco.fqdn,
  )

  url_aplicacao_banco_local = format(
    "postgresql://%s:%s@%s/buscapp",
    "buscapp_api",
    var.senha_app_local,
    local.endereco_banco_local,
  )

  # O Managed Redis usa acesso por chave nesta primeira versão; a chave vive no
  # estado do Terraform e é publicada também no Key Vault.
  cache_prod = one(azurerm_managed_redis.cache)

  url_cache_producao = local.cache_prod == null ? "" : format(
    "rediss://:%s@%s:%s",
    urlencode(local.cache_prod.default_database[0].primary_access_key),
    local.cache_prod.hostname,
    local.cache_prod.default_database[0].port,
  )

  url_cache_local = ""

  url_cache = var.modo_local ? local.url_cache_local : local.url_cache_producao

  # O hostname padrão do App Service segue o nome do recurso, então não é
  # preciso ler o atributo e criar um ciclo com APP_URL.
  url_aplicacao = var.modo_local ? "http://localhost:3000" : (
    var.dominio != null ? "https://${var.dominio}" : "https://${local.nome_base}-api.azurewebsites.net"
  )
}
