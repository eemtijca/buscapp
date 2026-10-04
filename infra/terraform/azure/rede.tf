# Rede privada de produção: sub-rede do App Service, sub-rede delegada do
# PostgreSQL e zona DNS privada. No modo local o Container Apps dispensa a VNet.

resource "azurerm_virtual_network" "principal" {
  count = var.modo_local || !var.habilitar_rede_privada ? 0 : 1

  name                = "${local.nome_base}-vnet"
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  address_space       = [var.faixa_vnet]

  tags = local.tags
}

resource "azurerm_subnet" "app" {
  count = var.modo_local || !var.habilitar_rede_privada ? 0 : 1

  name                 = "${local.nome_base}-app"
  resource_group_name  = azurerm_resource_group.principal.name
  virtual_network_name = azurerm_virtual_network.principal[0].name
  address_prefixes     = [cidrsubnet(var.faixa_vnet, 8, 0)]

  delegation {
    name = "app-service"

    service_delegation {
      name = "Microsoft.Web/serverFarms"
    }
  }
}

resource "azurerm_subnet" "banco" {
  count = var.modo_local || !var.habilitar_rede_privada ? 0 : 1

  name                 = "${local.nome_base}-banco"
  resource_group_name  = azurerm_resource_group.principal.name
  virtual_network_name = azurerm_virtual_network.principal[0].name
  address_prefixes     = [cidrsubnet(var.faixa_vnet, 8, 10)]

  delegation {
    name = "postgresql"

    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
    }
  }
}

resource "azurerm_private_dns_zone" "postgres" {
  count = var.modo_local || !var.habilitar_rede_privada ? 0 : 1

  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.principal.name

  tags = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  count = var.modo_local || !var.habilitar_rede_privada ? 0 : 1

  name                  = "${local.nome_base}-postgres"
  resource_group_name   = azurerm_resource_group.principal.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres[0].name
  virtual_network_id    = azurerm_virtual_network.principal[0].id
}
