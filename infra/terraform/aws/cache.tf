# Cache do barramento de eventos. Em produção usa Valkey com criptografia em
# repouso e em trânsito; no modo local o emulador roda sem TLS.

resource "aws_elasticache_subnet_group" "cache" {
  name       = "${local.nome_base}-cache"
  subnet_ids = aws_subnet.privada[*].id
}

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "${local.nome_base}-cache"
  description          = "Barramento de eventos do ${var.nome_aplicacao}"

  engine         = "valkey"
  engine_version = "8.0"
  node_type      = var.tamanho_no_cache

  num_cache_clusters         = local.num_nos_cache
  automatic_failover_enabled = !var.modo_local && local.num_nos_cache > 1
  multi_az_enabled           = !var.modo_local && local.num_nos_cache > 1

  subnet_group_name  = aws_elasticache_subnet_group.cache.name
  security_group_ids = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = var.modo_local ? false : true

  snapshot_retention_limit = var.modo_local ? 0 : 7
  apply_immediately        = var.modo_local

  tags = merge(local.tags, { Name = "${local.nome_base}-cache" })
}
