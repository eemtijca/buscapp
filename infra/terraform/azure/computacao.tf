# Grupo de recursos e computação. Em produção o alvo é o App Service; no modo
# local o módulo usa Container Apps, que o floci-az emula.

resource "azurerm_resource_group" "principal" {
  name     = "${local.nome_base}-rg"
  location = var.localizacao

  tags = local.tags

  # O emulador não aceita PATCH no grupo de recursos e devolve as tags vazias,
  # o que criaria um drift falso.
  lifecycle {
    ignore_changes = [tags]
  }
}

resource "azurerm_service_plan" "api" {
  count = var.modo_local ? 0 : 1

  name                   = "${local.nome_base}-plano"
  resource_group_name    = azurerm_resource_group.principal.name
  location               = azurerm_resource_group.principal.location
  os_type                = "Linux"
  sku_name               = var.sku_app_service
  zone_balancing_enabled = var.habilitar_zona_redundante_app

  tags = local.tags
}

resource "azurerm_linux_web_app" "api" {
  count = var.modo_local ? 0 : 1

  name                = "${local.nome_base}-api"
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  service_plan_id     = azurerm_service_plan.api[0].id
  https_only          = true

  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false

  virtual_network_subnet_id = var.habilitar_rede_privada ? azurerm_subnet.app[0].id : null

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                               = true
    health_check_path                       = "/api/saude"
    container_registry_use_managed_identity = true
    vnet_route_all_enabled                  = var.habilitar_rede_privada

    application_stack {
      docker_image_name   = var.imagem_aplicacao
      docker_registry_url = "https://${azurerm_container_registry.principal[0].login_server}"
    }
  }

  app_settings = {
    WEBSITES_PORT             = "3000"
    NODE_ENV                  = "production"
    PORT                      = "3000"
    HOST                      = "0.0.0.0"
    TZ_ESCOLA                 = var.tz_escola
    APP_URL                   = local.url_aplicacao
    TRUST_PROXY               = "true"
    COOKIE_SECURE             = "true"
    DB_POOL_MAX               = "10"
    STORAGE_DRIVER            = "azure-blob"
    AZURE_STORAGE_CONTAINER   = local.nome_container_anexos
    AZURE_STORAGE_ACCOUNT_URL = "https://${azurerm_storage_account.anexos.primary_blob_endpoint}"
    DATABASE_URL              = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.database_url[0].versionless_id})"
    MIGRATE_DATABASE_URL      = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.migrate_database_url[0].versionless_id})"
    APP_DB_PASSWORD           = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.app_db_password[0].versionless_id})"
    AUTH_PEPPER               = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.auth_pepper[0].versionless_id})"
    CRON_SECRET               = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.cron_secret[0].versionless_id})"
    REDIS_URL                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.redis_url[0].versionless_id})"
  }

  tags = local.tags
}

resource "azurerm_role_assignment" "app_acr_pull" {
  count = var.modo_local ? 0 : 1

  scope                = azurerm_container_registry.principal[0].id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.api[0].identity[0].principal_id
}

resource "azurerm_role_assignment" "app_kv_secrets" {
  count = var.modo_local ? 0 : 1

  scope                = azurerm_key_vault.principal[0].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.api[0].identity[0].principal_id
}

resource "azurerm_role_assignment" "app_blob_contributor" {
  count = var.modo_local ? 0 : 1

  scope                = azurerm_storage_account.anexos.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_web_app.api[0].identity[0].principal_id
}

resource "azurerm_container_app_environment" "local" {
  count = var.modo_local ? 1 : 0

  name                       = "${local.nome_base}-env"
  resource_group_name        = azurerm_resource_group.principal.name
  location                   = azurerm_resource_group.principal.location
  log_analytics_workspace_id = var.modo_local ? null : azurerm_log_analytics_workspace.principal[0].id

  tags = local.tags
}

resource "azurerm_container_app" "local" {
  count = var.modo_local ? 1 : 0

  name                         = "${local.nome_base}-api"
  resource_group_name          = azurerm_resource_group.principal.name
  container_app_environment_id = azurerm_container_app_environment.local[0].id
  revision_mode                = "Single"

  template {
    min_replicas    = 1
    max_replicas    = var.desired_count
    revision_suffix = var.sufixo_revisao

    container {
      name   = "api"
      image  = var.imagem_aplicacao
      cpu    = var.cpu_container_local
      memory = var.memoria_container_local

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "TZ_ESCOLA"
        value = var.tz_escola
      }

      env {
        name  = "APP_URL"
        value = local.url_aplicacao
      }

      env {
        name  = "TRUST_PROXY"
        value = "true"
      }

      env {
        name  = "COOKIE_SECURE"
        value = "false"
      }

      env {
        name  = "DB_POOL_MAX"
        value = "10"
      }

      env {
        name  = "STORAGE_DRIVER"
        value = "azure-blob"
      }

      env {
        name  = "AZURE_STORAGE_CONTAINER"
        value = local.nome_container_anexos
      }

      env {
        name  = "AZURE_STORAGE_CONNECTION_STRING"
        value = var.conexao_storage_local
      }

      env {
        name  = "DATABASE_URL"
        value = local.url_aplicacao_banco_local
      }

      env {
        name  = "MIGRATE_DATABASE_URL"
        value = local.url_banco_local
      }

      env {
        name  = "APP_DB_PASSWORD"
        value = var.senha_app_local
      }

      env {
        name  = "AUTH_PEPPER"
        value = var.auth_pepper_local
      }

      env {
        name  = "CRON_SECRET"
        value = var.cron_secret_local
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = local.tags
}
