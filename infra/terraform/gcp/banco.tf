# PostgreSQL gerenciado. Em produção a senha é efêmera e gravada apenas no
# Secret Manager, e a instância fica na rede privada com backup e PITR; no modo
# local valem a senha de desenvolvimento, o IP público e a proteção desligada.

resource "google_sql_database_instance" "banco" {
  name             = "${local.nome_base}-banco"
  project          = local.projeto
  region           = var.regiao
  database_version = "POSTGRES_${var.versao_postgres}"

  deletion_protection = local.protecao_exclusao

  settings {
    tier              = var.tamanho_instancia_banco
    availability_type = local.disponibilidade_banco
    disk_size         = var.tamanho_disco_banco_gb
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = var.modo_local ? true : false
      private_network = local.rede_privada ? google_compute_network.principal[0].id : null
    }

    dynamic "backup_configuration" {
      for_each = var.modo_local ? [] : [1]

      content {
        enabled                        = true
        point_in_time_recovery_enabled = local.habilitar_pitr
        start_time                     = "03:00"

        backup_retention_settings {
          retained_backups = local.retencao_backup
          retention_unit   = "COUNT"
        }
      }
    }
  }

  depends_on = [google_service_networking_connection.psa]
}

resource "google_sql_database" "buscapp" {
  name     = "buscapp"
  project  = local.projeto
  instance = google_sql_database_instance.banco.name
}

resource "google_sql_user" "gestor" {
  # O papel administrativo do Cloud SQL é o postgres, que aplica as migrações e
  # ajusta a senha do papel de runtime; os demais módulos chamam esse papel de
  # gestor. A API não exclui esse papel, então a exclusão o abandona e ele
  # desaparece junto com a instância.
  name     = "postgres"
  project  = local.projeto
  instance = google_sql_database_instance.banco.name

  password            = var.modo_local ? var.senha_banco_local : null
  password_wo         = var.modo_local ? null : ephemeral.random_password.banco.result
  password_wo_version = var.modo_local ? null : var.versao_segredos

  deletion_policy = "ABANDON"
}

resource "google_sql_user" "api" {
  name     = "buscapp_api"
  project  = local.projeto
  instance = google_sql_database_instance.banco.name

  password            = var.modo_local ? var.senha_app_local : null
  password_wo         = var.modo_local ? null : ephemeral.random_password.app.result
  password_wo_version = var.modo_local ? null : var.versao_segredos
}
