# Cache do barramento de eventos. Em produção o Memorystore é opcional e exige
# a rede privada; no modo local o app cai para o LISTEN/NOTIFY do PostgreSQL e
# nada é criado.

resource "google_redis_instance" "cache" {
  count = local.criar_redis ? 1 : 0

  name               = "${local.nome_base}-cache"
  project            = local.projeto
  region             = var.regiao
  tier               = "BASIC"
  memory_size_gb     = var.tamanho_memoria_redis_gb
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.principal[0].id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  labels             = local.rotulos
}
