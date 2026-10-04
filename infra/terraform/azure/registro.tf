# Registro de imagens de produção. No modo local a imagem vem do Docker da
# máquina e o ACR não é criado.

resource "azurerm_container_registry" "principal" {
  count = var.modo_local ? 0 : 1

  name                = local.nome_acr
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  sku                 = var.sku_acr
  admin_enabled       = false

  tags = local.tags
}
