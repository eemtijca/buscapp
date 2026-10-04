# Entradas do módulo AWS. Os padrões são seguros para produção; o arquivo
# terraform.tfvars.example do modo local reduz custo e desliga proteções.

variable "modo_local" {
  description = "Quando verdadeiro, usa o emulador Floci e recursos mínimos de teste."
  type        = bool
  default     = false
}

variable "endpoint_floci" {
  description = "Endereço do emulador Floci para o modo local."
  type        = string
  default     = "http://localhost:4566"
}

variable "regiao" {
  description = "Região AWS dos recursos."
  type        = string
  default     = "us-east-1"
}

variable "ambiente" {
  description = "Nome curto do ambiente, usado no nome dos recursos."
  type        = string
  default     = "prod"
}

variable "nome_aplicacao" {
  description = "Nome da aplicação, usado no nome dos recursos."
  type        = string
  default     = "buscapp"
}

variable "imagem_aplicacao" {
  description = "Imagem da API no formato repositorio:tag."
  type        = string
}

variable "vpc_cidr" {
  description = "Faixa CIDR da VPC dedicada."
  type        = string
  default     = "10.42.0.0/16"
}

variable "habilitar_nat" {
  description = "Cria NAT Gateway para a saída das sub-redes privadas."
  type        = bool
  default     = true
}

variable "tamanho_instancia_banco" {
  description = "Classe da instância RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "multi_az_banco" {
  description = "Habilita Multi-AZ no RDS em produção."
  type        = bool
  default     = true
}

variable "protecao_exclusao_banco" {
  description = "Impede a exclusão acidental do RDS."
  type        = bool
  default     = true
}

variable "retencao_backup_dias" {
  description = "Dias de retenção dos backups automáticos do RDS."
  type        = number
  default     = 7
}

variable "tamanho_no_cache" {
  description = "Tipo de nó do ElastiCache."
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_nos_cache" {
  description = "Quantidade de nós do ElastiCache."
  type        = number
  default     = 2
}

variable "habilitar_performance_insights" {
  description = "Liga o Performance Insights do RDS quando o provedor suporta."
  type        = bool
  default     = false
}

variable "cpu_tarefa" {
  description = "CPU da tarefa ECS em unidades de 1024."
  type        = number
  default     = 512
}

variable "memoria_tarefa" {
  description = "Memória da tarefa ECS em MiB."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Quantidade de tarefas ECS em produção."
  type        = number
  default     = 2
}

variable "certificado_arn" {
  description = "ARN do certificado ACM validado; obrigatório fora do modo local."
  type        = string
  default     = null
}

variable "dominio" {
  description = "Domínio público da aplicação; opcional."
  type        = string
  default     = null
}

variable "zona_hospedada_id" {
  description = "ID da zona Route 53 para o alias do domínio; opcional."
  type        = string
  default     = null
}

variable "retencao_logs_dias" {
  description = "Retenção dos logs no CloudWatch."
  type        = number
  default     = 30
}

variable "habilitar_alarmes" {
  description = "Cria alarmes básicos de disponibilidade e capacidade."
  type        = bool
  default     = true
}

variable "emails_alarme" {
  description = "Endereços que recebem os alarmes; sem eles não há inscrição no tópico."
  type        = list(string)
  default     = []
}

variable "senha_banco_local" {
  description = "Senha de desenvolvimento do banco usada somente no modo local."
  type        = string
  default     = "buscapp_dev_local"
  sensitive   = true
}

variable "senha_app_local" {
  description = "Senha de desenvolvimento do papel de runtime usada somente no modo local."
  type        = string
  default     = "buscapp_api_local"
  sensitive   = true
}

variable "auth_pepper_local" {
  description = "Pepper de desenvolvimento usado somente no modo local."
  type        = string
  default     = "dev-pepper-local-com-mais-de-16-caracteres"
  sensitive   = true
}

variable "cron_secret_local" {
  description = "Segredo do agendador usado somente no modo local."
  type        = string
  default     = "dev-cron-secret-local"
  sensitive   = true
}

variable "redis_url_local" {
  description = "URL do Redis no modo local; o endereço do emulador pode variar."
  type        = string
  default     = "redis://localhost:6379"
}

variable "versao_segredos" {
  description = "Incrementa para rotacionar as senhas geradas em produção."
  type        = number
  default     = 1
}

variable "tz_escola" {
  description = "Fuso horário usado pela aplicação."
  type        = string
  default     = "America/Sao_Paulo"
}
