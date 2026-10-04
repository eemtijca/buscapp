# No modo local o provider fala com o emulador floci-az por HTTPS (ambiente
# stack e metadata_host); fora dele valem as credenciais do ambiente Azure.

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = var.modo_local
      recover_soft_deleted_key_vaults = !var.modo_local
    }
  }

  environment   = var.modo_local ? "stack" : "public"
  metadata_host = var.modo_local ? var.endpoint_local : null

  use_cli = var.modo_local ? false : null

  resource_provider_registrations = var.modo_local ? "none" : null

  subscription_id = var.modo_local ? "00000000-0000-0000-0000-000000000001" : null
  tenant_id       = var.modo_local ? "00000000-0000-0000-0000-000000000002" : null
  client_id       = var.modo_local ? "00000000-0000-0000-0000-000000000003" : null
  client_secret   = var.modo_local ? "fake-secret" : null
}
