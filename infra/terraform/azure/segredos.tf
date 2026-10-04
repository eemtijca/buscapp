# Cofre de segredos e as credenciais da aplicação. O Key Vault é usado apenas
# pelo caminho de produção; no modo local o Container Apps recebe variáveis de
# desenvolvimento e o emulador não responde ao data plane do cofre.

data "azurerm_client_config" "atual" {}

resource "azurerm_key_vault" "principal" {
  count = var.modo_local ? 0 : 1

  name                = local.nome_kv
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  tenant_id           = data.azurerm_client_config.atual.tenant_id
  sku_name            = "standard"

  rbac_authorization_enabled = true
  purge_protection_enabled   = true
  soft_delete_retention_days = 7

  tags = local.tags
}

resource "azurerm_key_vault_secret" "database_url" {
  count = var.modo_local ? 0 : 1

  name             = "database-url"
  key_vault_id     = azurerm_key_vault.principal[0].id
  value_wo         = local.url_aplicacao_banco_producao
  value_wo_version = var.versao_segredos
}

resource "azurerm_key_vault_secret" "migrate_database_url" {
  count = var.modo_local ? 0 : 1

  name             = "migrate-database-url"
  key_vault_id     = azurerm_key_vault.principal[0].id
  value_wo         = local.url_migracao_producao
  value_wo_version = var.versao_segredos
}

resource "azurerm_key_vault_secret" "app_db_password" {
  count = var.modo_local ? 0 : 1

  name             = "app-db-password"
  key_vault_id     = azurerm_key_vault.principal[0].id
  value_wo         = ephemeral.random_password.app.result
  value_wo_version = var.versao_segredos
}

resource "azurerm_key_vault_secret" "auth_pepper" {
  count = var.modo_local ? 0 : 1

  name             = "auth-pepper"
  key_vault_id     = azurerm_key_vault.principal[0].id
  value_wo         = ephemeral.random_password.auth_pepper.result
  value_wo_version = var.versao_segredos
}

resource "azurerm_key_vault_secret" "cron_secret" {
  count = var.modo_local ? 0 : 1

  name             = "cron-secret"
  key_vault_id     = azurerm_key_vault.principal[0].id
  value_wo         = ephemeral.random_password.cron.result
  value_wo_version = var.versao_segredos
}

resource "azurerm_key_vault_secret" "redis_url" {
  count = var.modo_local ? 0 : 1

  name         = "redis-url"
  key_vault_id = azurerm_key_vault.principal[0].id
  value        = local.url_cache_producao
}

ephemeral "random_password" "auth_pepper" {
  length  = 48
  special = false
}

ephemeral "random_password" "cron" {
  length  = 48
  special = false
}
