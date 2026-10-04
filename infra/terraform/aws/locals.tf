# Dados derivados e nomes padronizados dos recursos.

data "aws_availability_zones" "disponiveis" {
  state = "available"
}

data "aws_caller_identity" "atual" {}

locals {
  endpoint_floci = var.endpoint_floci

  tags = {
    Aplicacao     = var.nome_aplicacao
    Ambiente      = var.ambiente
    GerenciadoPor = "terraform"
  }

  nome_base = "${var.nome_aplicacao}-${var.ambiente}"

  zonas = slice(data.aws_availability_zones.disponiveis.names, 0, 2)

  subredes_publicas = [
    for indice, zona in local.zonas : cidrsubnet(var.vpc_cidr, 8, indice)
  ]

  subredes_privadas = [
    for indice, zona in local.zonas : cidrsubnet(var.vpc_cidr, 8, indice + 10)
  ]

  contagem_tarefas = var.modo_local ? 1 : var.desired_count

  habilitar_nat = var.modo_local ? false : var.habilitar_nat

  multi_az = var.modo_local ? false : var.multi_az_banco

  protecao_exclusao = var.modo_local ? false : var.protecao_exclusao_banco

  retencao_backup = var.modo_local ? 1 : var.retencao_backup_dias

  num_nos_cache = var.modo_local ? 1 : var.num_nos_cache

  # Força SSL no banco somente fora do modo local: o PostgreSQL dos emuladores
  # roda sem TLS.
  force_ssl = var.modo_local ? 0 : 1

  ssl_modo = var.modo_local ? "" : "?sslmode=require"

  url_migracao_local = format(
    "postgresql://%s:%s@%s:%s/buscapp%s",
    "buscapp_gestor",
    var.senha_banco_local,
    aws_db_instance.banco.address,
    aws_db_instance.banco.port,
    local.ssl_modo,
  )

  url_migracao_producao = format(
    "postgresql://%s:%s@%s:%s/buscapp%s",
    "buscapp_gestor",
    ephemeral.random_password.banco.result,
    aws_db_instance.banco.address,
    aws_db_instance.banco.port,
    local.ssl_modo,
  )

  url_aplicacao_banco_local = format(
    "postgresql://%s:%s@%s:%s/buscapp%s",
    "buscapp_api",
    var.senha_app_local,
    aws_db_instance.banco.address,
    aws_db_instance.banco.port,
    local.ssl_modo,
  )

  url_aplicacao_banco_producao = format(
    "postgresql://%s:%s@%s:%s/buscapp%s",
    "buscapp_api",
    ephemeral.random_password.app.result,
    aws_db_instance.banco.address,
    aws_db_instance.banco.port,
    local.ssl_modo,
  )

  url_cache = var.modo_local ? var.redis_url_local : format(
    "%s://%s:%s",
    "rediss",
    aws_elasticache_replication_group.cache.primary_endpoint_address,
    aws_elasticache_replication_group.cache.port,
  )

  url_aplicacao = var.dominio != null ? "https://${var.dominio}" : (
    var.modo_local ? "http://localhost:3000" : "https://${aws_lb.principal.dns_name}"
  )
}
