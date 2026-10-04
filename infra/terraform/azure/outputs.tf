# Saídas usadas pelos scripts de implantação.

output "url_aplicacao" {
  description = "URL pública da aplicação."
  value       = local.url_aplicacao
}

output "endpoint_banco" {
  description = "Endereço do PostgreSQL gerenciado."
  value       = azurerm_postgresql_flexible_server.banco.fqdn
  sensitive   = true
}

output "endpoint_cache" {
  description = "URL do cache."
  value       = local.url_cache
  sensitive   = true
}

output "conta_storage" {
  description = "Nome da conta de armazenamento dos anexos."
  value       = azurerm_storage_account.anexos.name
}

output "container_anexos" {
  description = "Nome do contêiner de anexos."
  value       = local.nome_container_anexos
}

output "repositorio_imagem" {
  description = "Login server do ACR; vazio no modo local."
  value       = var.modo_local ? "" : azurerm_container_registry.principal[0].login_server
}

output "key_vault" {
  description = "Nome do Key Vault."
  value       = one(azurerm_key_vault.principal[*].name)
}

output "id_container_app" {
  description = "Identificador do Container App no modo local."
  value       = var.modo_local ? azurerm_container_app.local[0].id : ""
}
