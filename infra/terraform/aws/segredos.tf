# Segredos da aplicação. Em produção os valores nascem efêmeros e só chegam ao
# Secrets Manager; no modo local valem os valores de desenvolvimento.

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

resource "aws_secretsmanager_secret" "database_url" {
  name = "${local.nome_base}/database-url"

  tags = merge(local.tags, { Name = "${local.nome_base}/database-url" })
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id                = aws_secretsmanager_secret.database_url.id
  secret_string            = var.modo_local ? local.url_aplicacao_banco_local : null
  secret_string_wo         = var.modo_local ? null : local.url_aplicacao_banco_producao
  secret_string_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "aws_secretsmanager_secret" "migrate_database_url" {
  name = "${local.nome_base}/migrate-database-url"

  tags = merge(local.tags, { Name = "${local.nome_base}/migrate-database-url" })
}

resource "aws_secretsmanager_secret_version" "migrate_database_url" {
  secret_id                = aws_secretsmanager_secret.migrate_database_url.id
  secret_string            = var.modo_local ? local.url_migracao_local : null
  secret_string_wo         = var.modo_local ? null : local.url_migracao_producao
  secret_string_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "aws_secretsmanager_secret" "app_db_password" {
  name = "${local.nome_base}/app-db-password"

  tags = merge(local.tags, { Name = "${local.nome_base}/app-db-password" })
}

resource "aws_secretsmanager_secret_version" "app_db_password" {
  secret_id                = aws_secretsmanager_secret.app_db_password.id
  secret_string            = var.modo_local ? var.senha_app_local : null
  secret_string_wo         = var.modo_local ? null : ephemeral.random_password.app.result
  secret_string_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "aws_secretsmanager_secret" "auth_pepper" {
  name = "${local.nome_base}/auth-pepper"

  tags = merge(local.tags, { Name = "${local.nome_base}/auth-pepper" })
}

resource "aws_secretsmanager_secret_version" "auth_pepper" {
  secret_id                = aws_secretsmanager_secret.auth_pepper.id
  secret_string            = var.modo_local ? var.auth_pepper_local : null
  secret_string_wo         = var.modo_local ? null : ephemeral.random_password.auth_pepper.result
  secret_string_wo_version = var.modo_local ? null : var.versao_segredos
}

resource "aws_secretsmanager_secret" "cron" {
  name = "${local.nome_base}/cron-secret"

  tags = merge(local.tags, { Name = "${local.nome_base}/cron-secret" })
}

resource "aws_secretsmanager_secret_version" "cron" {
  secret_id                = aws_secretsmanager_secret.cron.id
  secret_string            = var.modo_local ? var.cron_secret_local : null
  secret_string_wo         = var.modo_local ? null : ephemeral.random_password.cron.result
  secret_string_wo_version = var.modo_local ? null : var.versao_segredos
}
