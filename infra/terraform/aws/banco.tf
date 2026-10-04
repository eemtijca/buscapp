# PostgreSQL gerenciado. Em produção a senha é efêmera e gravada apenas no
# Secrets Manager; no modo local vale a senha de desenvolvimento do tfvars.

resource "aws_db_subnet_group" "banco" {
  name       = "${local.nome_base}-banco"
  subnet_ids = aws_subnet.privada[*].id

  tags = merge(local.tags, { Name = "${local.nome_base}-banco" })
}

resource "aws_db_parameter_group" "banco" {
  name   = "${local.nome_base}-pg17"
  family = "postgres17"

  parameter {
    name  = "rds.force_ssl"
    value = tostring(local.force_ssl)
  }

  tags = merge(local.tags, { Name = "${local.nome_base}-pg17" })
}

resource "aws_db_instance" "banco" {
  identifier                 = "${local.nome_base}-banco"
  engine                     = "postgres"
  engine_version             = "17"
  instance_class             = var.tamanho_instancia_banco
  allocated_storage          = 20
  storage_type               = "gp3"
  storage_encrypted          = true
  db_name                    = "buscapp"
  username                   = "buscapp_gestor"
  password                   = var.modo_local ? var.senha_banco_local : null
  password_wo                = var.modo_local ? null : ephemeral.random_password.banco.result
  password_wo_version        = var.modo_local ? null : var.versao_segredos
  db_subnet_group_name       = aws_db_subnet_group.banco.name
  parameter_group_name       = aws_db_parameter_group.banco.name
  vpc_security_group_ids     = [aws_security_group.banco.id]
  publicly_accessible        = false
  multi_az                   = local.multi_az
  backup_retention_period    = local.retencao_backup
  deletion_protection        = local.protecao_exclusao
  skip_final_snapshot        = var.modo_local
  final_snapshot_identifier  = var.modo_local ? null : "${local.nome_base}-final"
  apply_immediately          = var.modo_local
  auto_minor_version_upgrade = true

  performance_insights_enabled = var.modo_local ? false : var.habilitar_performance_insights

  enabled_cloudwatch_logs_exports = var.modo_local ? [] : ["postgresql"]

  tags = merge(local.tags, { Name = "${local.nome_base}-banco" })
}
