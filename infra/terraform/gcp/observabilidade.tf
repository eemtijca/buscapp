# Observabilidade. O Cloud Run envia logs e métricas ao Cloud Logging e ao
# Cloud Monitoring automaticamente; o alerta de erros 5xx existe apenas em
# produção e atrás de habilitar_alarmes.

resource "google_monitoring_notification_channel" "email" {
  for_each = var.habilitar_alarmes && !var.modo_local ? toset(var.emails_alarme) : toset([])

  project      = local.projeto
  display_name = "Email ${index(var.emails_alarme, each.value) + 1}"
  type         = "email"

  labels = {
    email_address = each.value
  }
}

resource "google_monitoring_alert_policy" "erros_5xx" {
  count = var.habilitar_alarmes && !var.modo_local ? 1 : 0

  project      = local.projeto
  display_name = "${local.nome_base} erros 5xx"
  combiner     = "OR"

  conditions {
    display_name = "Erros 5xx no Cloud Run"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${local.nome_base}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [for canal in google_monitoring_notification_channel.email : canal.id]

  alert_strategy {
    auto_close = "86400s"
  }
}
