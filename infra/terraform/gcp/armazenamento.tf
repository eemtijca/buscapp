# Bucket privado dos anexos, com acesso uniforme, bloqueio de acesso público,
# versionamento e ciclo de vida. No modo local o app usa o driver de disco e o
# bucket existe apenas para validar a infraestrutura; em produção o app usa o
# driver S3 do GCS com as chaves HMAC guardadas no Secret Manager.

resource "google_storage_bucket" "anexos" {
  name          = local.nome_bucket
  project       = local.projeto
  location      = var.localizacao_bucket
  storage_class = "STANDARD"
  force_destroy = var.modo_local

  # O emulador não devolve iamConfiguration, então o acesso uniforme fica
  # restrito à produção para não gerar drift falso no modo local.
  uniform_bucket_level_access = var.modo_local ? null : true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
  }

  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }

    condition {
      age = 7
    }
  }

  dynamic "cors" {
    for_each = var.modo_local ? [] : [1]

    content {
      origin          = [local.url_aplicacao]
      method          = ["PUT"]
      response_header = ["ETag"]
      max_age_seconds = 3000
    }
  }

  labels = local.rotulos
}

resource "google_storage_hmac_key" "api" {
  count = var.modo_local ? 0 : 1

  project               = local.projeto
  service_account_email = google_service_account.api.email
  state                 = "ACTIVE"
}
