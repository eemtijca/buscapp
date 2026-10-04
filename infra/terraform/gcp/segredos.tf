# Segredos da aplicação no Secret Manager. Em produção os valores nascem
# efêmeros e só chegam ao cofre; no modo local valem os valores de
# desenvolvimento do tfvars.

ephemeral "random_password" "banco" {
  length  = 32
  special = false
}

ephemeral "random_password" "app" {
  length  = 32
  special = false
}

ephemeral "random_password" "auth_pepper" {
  length  = 48
  special = false
}

ephemeral "random_password" "cron" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.nome_base}-database-url"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.modo_local ? local.url_aplicacao_banco_local : null

  secret_data_wo         = var.modo_local ? null : local.url_aplicacao_banco_producao
  secret_data_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "google_secret_manager_secret" "migrate_database_url" {
  secret_id = "${local.nome_base}-migrate-database-url"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "migrate_database_url" {
  secret      = google_secret_manager_secret.migrate_database_url.id
  secret_data = var.modo_local ? local.url_migracao_local : null

  secret_data_wo         = var.modo_local ? null : local.url_migracao_producao
  secret_data_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "google_secret_manager_secret" "app_db_password" {
  secret_id = "${local.nome_base}-app-db-password"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "app_db_password" {
  secret      = google_secret_manager_secret.app_db_password.id
  secret_data = var.modo_local ? var.senha_app_local : null

  secret_data_wo         = var.modo_local ? null : ephemeral.random_password.app.result
  secret_data_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "google_secret_manager_secret" "auth_pepper" {
  secret_id = "${local.nome_base}-auth-pepper"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "auth_pepper" {
  secret      = google_secret_manager_secret.auth_pepper.id
  secret_data = var.modo_local ? var.auth_pepper_local : null

  secret_data_wo         = var.modo_local ? null : ephemeral.random_password.auth_pepper.result
  secret_data_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "google_secret_manager_secret" "cron" {
  secret_id = "${local.nome_base}-cron-secret"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "cron" {
  secret      = google_secret_manager_secret.cron.id
  secret_data = var.modo_local ? var.cron_secret_local : null

  secret_data_wo         = var.modo_local ? null : ephemeral.random_password.cron.result
  secret_data_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "google_secret_manager_secret" "s3_access_key" {
  count = var.modo_local ? 0 : 1

  secret_id = "${local.nome_base}-s3-access-key"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "s3_access_key" {
  count = var.modo_local ? 0 : 1

  secret                 = google_secret_manager_secret.s3_access_key[0].id
  secret_data_wo         = google_storage_hmac_key.api[0].access_id
  secret_data_wo_version = var.versao_segredos
}

resource "google_secret_manager_secret" "s3_secret_key" {
  count = var.modo_local ? 0 : 1

  secret_id = "${local.nome_base}-s3-secret-key"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "s3_secret_key" {
  count = var.modo_local ? 0 : 1

  secret                 = google_secret_manager_secret.s3_secret_key[0].id
  secret_data_wo         = google_storage_hmac_key.api[0].secret
  secret_data_wo_version = var.versao_segredos
}

resource "google_secret_manager_secret" "redis_url" {
  count = local.criar_redis ? 1 : 0

  secret_id = "${local.nome_base}-redis-url"
  project   = local.projeto

  replication {
    auto {}
  }

  # O emulador não guarda rótulos em segredos, então eles ficam restritos à
  # produção para não gerar drift falso no modo local.
  labels = var.modo_local ? null : local.rotulos
}

resource "google_secret_manager_secret_version" "redis_url" {
  count = local.criar_redis ? 1 : 0

  secret      = google_secret_manager_secret.redis_url[0].id
  secret_data = local.url_cache_producao
}
