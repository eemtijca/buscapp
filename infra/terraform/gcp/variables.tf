# Entradas do módulo GCP. Os padrões são seguros para produção; o arquivo
# terraform.tfvars.local.example reduz custo e usa o emulador floci-gcp.

variable "modo_local" {
  description = "Quando verdadeiro, usa o emulador floci-gcp e recursos mínimos de teste."
  type        = bool
  default     = false
}

variable "endpoint_local" {
  description = "Endereço do emulador floci-gcp no modo local."
  type        = string
  default     = "http://localhost:4588"
}

variable "projeto" {
  description = "Identificador do projeto GCP; obrigatório fora do modo local."
  type        = string
  default     = null
}

variable "regiao" {
  description = "Região GCP dos recursos."
  type        = string
  default     = "us-central1"
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

variable "habilitar_rede_privada" {
  description = "Cria VPC, sub-rede e Private Service Access do Cloud SQL em produção."
  type        = bool
  default     = true
}

variable "faixa_rede" {
  description = "Faixa CIDR da VPC de produção."
  type        = string
  default     = "10.62.0.0/16"
}

variable "localizacao_bucket" {
  description = "Localização do bucket dos anexos, como US ou us-central1."
  type        = string
  default     = "US"
}

variable "versao_postgres" {
  description = "Versão principal do PostgreSQL."
  type        = string
  default     = "17"
}

variable "tamanho_instancia_banco" {
  description = "Tier do Cloud SQL, como db-custom-1-3840 ou db-f1-micro."
  type        = string
  default     = "db-custom-1-3840"
}

variable "tamanho_disco_banco_gb" {
  description = "Tamanho do disco do Cloud SQL em GB."
  type        = number
  default     = 10
}

variable "disponibilidade_banco" {
  description = "Disponibilidade do Cloud SQL: ZONAL ou REGIONAL."
  type        = string
  default     = "REGIONAL"
}

variable "protecao_exclusao_banco" {
  description = "Impede a exclusão acidental do Cloud SQL."
  type        = bool
  default     = true
}

variable "retencao_backup_dias" {
  description = "Quantidade de backups automáticos retidos no Cloud SQL."
  type        = number
  default     = 7
}

variable "habilitar_pitr" {
  description = "Liga a recuperação point-in-time do Cloud SQL em produção."
  type        = bool
  default     = true
}

variable "habilitar_redis" {
  description = "Cria o Memorystore e publica REDIS_URL em produção."
  type        = bool
  default     = false
}

variable "tamanho_memoria_redis_gb" {
  description = "Memória do Memorystore em GB."
  type        = number
  default     = 1
}

variable "cpu_servico" {
  description = "CPU do contêiner do Cloud Run."
  type        = string
  default     = "1"
}

variable "memoria_servico" {
  description = "Memória do contêiner do Cloud Run."
  type        = string
  default     = "512Mi"
}

variable "min_instancias" {
  description = "Réplicas mínimas do Cloud Run em produção."
  type        = number
  default     = 0
}

variable "max_instancias" {
  description = "Réplicas máximas do Cloud Run em produção."
  type        = number
  default     = 4
}

variable "habilitar_alarmes" {
  description = "Cria o alerta de erros 5xx do Cloud Run em produção."
  type        = bool
  default     = true
}

variable "emails_alarme" {
  description = "Endereços que recebem os alertas."
  type        = list(string)
  default     = []
}

variable "senha_banco_local" {
  description = "Senha de desenvolvimento do administrador do PostgreSQL no modo local."
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

variable "url_banco_local" {
  description = "Sobrescreve a URL do banco do runtime no modo local quando o DNS do emulador não resolve."
  type        = string
  default     = null
}

variable "url_migrate_local" {
  description = "Sobrescreve a URL de migração no modo local quando o DNS do emulador não resolve."
  type        = string
  default     = null
}

variable "url_redis_local" {
  description = "URL do Redis no modo local; sem ela o app usa o LISTEN/NOTIFY do PostgreSQL."
  type        = string
  default     = null
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

check "projeto_obrigatorio" {
  assert {
    condition     = var.modo_local || var.projeto != null
    error_message = "Fora do modo local, informe o projeto GCP."
  }
}

check "redis_exige_rede" {
  assert {
    condition     = !var.habilitar_redis || var.modo_local || var.habilitar_rede_privada
    error_message = "O Memorystore exige a rede privada; ative habilitar_rede_privada ou desligue habilitar_redis."
  }
}
