# PostgreSQL Flexible Server e o cache do barramento de eventos.

ephemeral "random_password" "banco" {
  length  = 32
  special = false
}

ephemeral "random_password" "app" {
  length  = 32
  special = false
}

resource "azurerm_postgresql_flexible_server" "banco" {
  name                = "${local.nome_base}-pg"
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  version             = var.versao_postgres
  sku_name            = var.sku_banco
  storage_mb          = var.tamanho_disco_banco_mb

  administrator_login               = "buscapp_gestor"
  administrator_password            = var.modo_local ? var.senha_banco_local : null
  administrator_password_wo         = var.modo_local ? null : ephemeral.random_password.banco.result
  administrator_password_wo_version = var.modo_local ? null : var.versao_segredos

  backup_retention_days        = local.retencao_backup
  geo_redundant_backup_enabled = var.modo_local ? false : var.habilitar_geo_backup

  public_network_access_enabled = local.permitir_rede_publica_banco

  delegated_subnet_id = var.modo_local || !var.habilitar_rede_privada ? null : azurerm_subnet.banco[0].id
  private_dns_zone_id = var.modo_local || !var.habilitar_rede_privada ? null : azurerm_private_dns_zone.postgres[0].id

  dynamic "high_availability" {
    for_each = var.modo_local || !var.habilitar_alta_disponibilidade_banco ? [] : [1]

    content {
      mode = "ZoneRedundant"
    }
  }

  tags = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "buscapp" {
  name      = "buscapp"
  server_id = azurerm_postgresql_flexible_server.banco.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "local" {
  count = var.modo_local ? 1 : 0

  name             = "permitir-local"
  server_id        = azurerm_postgresql_flexible_server.banco.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# No modo local o barramento cai para o LISTEN/NOTIFY do PostgreSQL. Em
# produção vale o Azure Managed Redis, que substitui o serviço em fim de vida.
resource "azurerm_managed_redis" "cache" {
  count = var.modo_local ? 0 : 1

  name                = "${local.nome_base}-cache"
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  sku_name            = var.sku_cache

  public_network_access = var.habilitar_rede_privada ? "Disabled" : "Enabled"

  default_database {}

  tags = local.tags
}
