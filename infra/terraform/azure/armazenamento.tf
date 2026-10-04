# Conta de armazenamento dos anexos. O acesso usa identidade gerenciada e o
# acesso público fica bloqueado.

resource "azurerm_storage_account" "anexos" {
  name                     = local.nome_storage
  resource_group_name      = azurerm_resource_group.principal.name
  location                 = azurerm_resource_group.principal.location
  account_tier             = "Standard"
  account_replication_type = var.modo_local ? "LRS" : "ZRS"

  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = var.modo_local
  queue_encryption_key_type       = "Account"
  table_encryption_key_type       = "Account"

  # O emulador não conclui a atualização de blobServices, então os recursos de
  # versionamento e retenção ficam restritos ao modo de produção.
  dynamic "blob_properties" {
    for_each = var.modo_local ? [] : [1]

    content {
      versioning_enabled = true

      delete_retention_policy {
        days = 7
      }

      container_delete_retention_policy {
        days = 7
      }
    }
  }

  tags = local.tags
}

resource "azurerm_storage_container" "anexos" {
  count = var.modo_local ? 0 : 1

  name                  = local.nome_container_anexos
  storage_account_id    = azurerm_storage_account.anexos.id
  container_access_type = "private"
}
