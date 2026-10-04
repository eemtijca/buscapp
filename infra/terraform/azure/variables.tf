# Entradas do módulo Azure. Os padrões valem para produção; o arquivo local
# reduz custo e usa os serviços que o floci-az emula.

variable "modo_local" {
  description = "Quando verdadeiro, usa o emulador floci-az e Container Apps."
  type        = bool
  default     = false
}

variable "endpoint_local" {
  description = "Host do emulador floci-az para o modo local."
  type        = string
  default     = "localhost:4577"
}

variable "localizacao" {
  description = "Região Azure dos recursos."
  type        = string
  default     = "brazilsouth"
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
  description = "Cria VNet, sub-redes e DNS privado do PostgreSQL."
  type        = bool
  default     = true
}

variable "faixa_vnet" {
  description = "Faixa CIDR da VNet."
  type        = string
  default     = "10.52.0.0/16"
}

variable "sku_banco" {
  description = "SKU do PostgreSQL Flexible Server."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "versao_postgres" {
  description = "Versão principal do PostgreSQL."
  type        = string
  default     = "17"
}

variable "tamanho_disco_banco_mb" {
  description = "Tamanho do disco do PostgreSQL em MiB."
  type        = number
  default     = 32768
}

variable "retencao_backup_dias" {
  description = "Dias de retenção dos backups do PostgreSQL."
  type        = number
  default     = 14
}

variable "habilitar_alta_disponibilidade_banco" {
  description = "Liga a alta disponibilidade zone-redundant do PostgreSQL."
  type        = bool
  default     = false
}

variable "habilitar_geo_backup" {
  description = "Liga o backup geo-redundante do PostgreSQL, definido na criação."
  type        = bool
  default     = false
}

variable "sku_cache" {
  description = "SKU do Azure Managed Redis em produção."
  type        = string
  default     = "Balanced_B0"
}

variable "sku_acr" {
  description = "SKU do Azure Container Registry."
  type        = string
  default     = "Standard"
}

variable "sku_app_service" {
  description = "SKU do plano do App Service em produção."
  type        = string
  default     = "P1v3"
}

variable "habilitar_zona_redundante_app" {
  description = "Distribui o App Service em zonas de disponibilidade."
  type        = bool
  default     = false
}

variable "desired_count" {
  description = "Réplicas do Container Apps no modo local."
  type        = number
  default     = 1
}

variable "sufixo_revisao" {
  description = "Sufixo da revisão do Container Apps; troque para forçar uma revisão nova."
  type        = string
  default     = "v1"
}

variable "cpu_container_local" {
  description = "CPU do Container App no modo local."
  type        = number
  default     = 0.5
}

variable "memoria_container_local" {
  description = "Memória do Container App no modo local."
  type        = string
  default     = "1Gi"
}

variable "dominio" {
  description = "Domínio público do App Service; opcional."
  type        = string
  default     = null
}

variable "retencao_logs_dias" {
  description = "Retenção do workspace do Log Analytics."
  type        = number
  default     = 30
}

variable "habilitar_alarmes" {
  description = "Cria alertas básicos de disponibilidade e capacidade."
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
  default     = "BuscappLocal!2026"
  sensitive   = true
}

variable "senha_app_local" {
  description = "Senha de desenvolvimento do papel de runtime no modo local."
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

variable "endereco_banco_local" {
  description = "Endereço host:porta do PostgreSQL no modo local quando o nome do contêiner não resolve."
  type        = string
  default     = null
}

variable "conexao_storage_local" {
  description = "Connection string do Blob emulado usada pelo modo local."
  type        = string
  default     = ""
  sensitive   = true
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
