# Rede privada de produção: VPC dedicada, sub-rede do Cloud Run e faixa do
# Private Service Access usada pelo Cloud SQL. No modo local o emulador
# dispensa a VPC.

resource "google_compute_network" "principal" {
  count = local.rede_privada ? 1 : 0

  name                    = "${local.nome_base}-vpc"
  project                 = local.projeto
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "app" {
  count = local.rede_privada ? 1 : 0

  name          = "${local.nome_base}-app"
  project       = local.projeto
  region        = var.regiao
  network       = google_compute_network.principal[0].id
  ip_cidr_range = cidrsubnet(var.faixa_rede, 8, 0)
}

resource "google_compute_global_address" "psa" {
  count = local.rede_privada ? 1 : 0

  name          = "${local.nome_base}-psa"
  project       = local.projeto
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.principal[0].id
}

resource "google_service_networking_connection" "psa" {
  count = local.rede_privada ? 1 : 0

  network                 = google_compute_network.principal[0].id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.psa[0].name]
}
