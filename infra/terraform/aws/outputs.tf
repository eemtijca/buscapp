# Saídas usadas pelos scripts de implantação e pelos demais módulos.

output "url_aplicacao" {
  description = "URL pública da aplicação."
  value       = local.url_aplicacao
}

output "alb_dns" {
  description = "Nome DNS do balanceador."
  value       = aws_lb.principal.dns_name
}

output "endpoint_banco" {
  description = "Endereço do PostgreSQL gerenciado."
  value       = "${aws_db_instance.banco.address}:${aws_db_instance.banco.port}"
  sensitive   = true
}

output "endpoint_cache" {
  description = "Endereço do cache."
  value       = local.url_cache
  sensitive   = true
}

output "bucket_anexos" {
  description = "Bucket dos anexos."
  value       = aws_s3_bucket.anexos.bucket
}

output "repositorio_imagem" {
  description = "URL do repositório ECR; vazio no modo local."
  value       = var.modo_local ? "" : aws_ecr_repository.api[0].repository_url
}

output "segredo_database_url" {
  description = "ARN do segredo com a URL do banco."
  value       = aws_secretsmanager_secret.database_url.arn
}

output "cluster_ecs" {
  description = "Nome do cluster ECS."
  value       = aws_ecs_cluster.api.name
}

output "servico_ecs" {
  description = "Nome do serviço ECS."
  value       = aws_ecs_service.api.name
}
