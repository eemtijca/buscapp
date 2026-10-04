# No modo local os serviços apontam para o emulador floci-gcp e a autenticação
# usa GOOGLE_OAUTH_ACCESS_TOKEN=floci no ambiente; fora dele os endpoints ficam
# nulos e o provider usa os endereços oficiais com as credenciais do ambiente.

provider "google" {
  project = local.projeto
  region  = var.regiao

  # O emulador não conhece faturamento, então o cabeçalho de projeto de cota
  # fica desligado no modo local.
  user_project_override = var.modo_local ? false : null

  storage_custom_endpoint          = var.modo_local ? "${var.endpoint_local}/storage/v1/" : null
  iam_custom_endpoint              = var.modo_local ? "${var.endpoint_local}/" : null
  iam_beta_custom_endpoint         = var.modo_local ? "${var.endpoint_local}/v1/" : null
  secret_manager_custom_endpoint   = var.modo_local ? "${var.endpoint_local}/v1/" : null
  cloud_run_custom_endpoint        = var.modo_local ? "${var.endpoint_local}/v2/" : null
  cloud_run_v2_custom_endpoint     = var.modo_local ? "${var.endpoint_local}/v2/" : null
  sql_custom_endpoint              = var.modo_local ? "${var.endpoint_local}/sql/v1beta4/" : null
  kms_custom_endpoint              = var.modo_local ? "${var.endpoint_local}/v1/" : null
  pubsub_custom_endpoint           = var.modo_local ? "${var.endpoint_local}/v1/" : null
  big_query_custom_endpoint        = var.modo_local ? "${var.endpoint_local}/bigquery/v2/" : null
  service_usage_custom_endpoint    = var.modo_local ? "${var.endpoint_local}/v1/" : null
  resource_manager_custom_endpoint = var.modo_local ? "${var.endpoint_local}/v1/" : null
}
