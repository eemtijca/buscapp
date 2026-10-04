# Observabilidade e alertas.

resource "azurerm_log_analytics_workspace" "principal" {
  count = var.modo_local ? 0 : 1

  name                = "${local.nome_base}-logs"
  resource_group_name = azurerm_resource_group.principal.name
  location            = azurerm_resource_group.principal.location
  sku                 = "PerGB2018"
  retention_in_days   = var.retencao_logs_dias

  tags = local.tags
}

resource "azurerm_monitor_action_group" "principal" {
  count = var.habilitar_alarmes && !var.modo_local ? 1 : 0

  name                = "${local.nome_base}-alertas"
  resource_group_name = azurerm_resource_group.principal.name
  short_name          = "buscapp"

  dynamic "email_receiver" {
    for_each = var.emails_alarme

    content {
      name          = "email-${index(var.emails_alarme, email_receiver.value)}"
      email_address = email_receiver.value
    }
  }

  tags = local.tags
}

resource "azurerm_monitor_metric_alert" "app_5xx" {
  count = var.habilitar_alarmes && !var.modo_local ? 1 : 0

  name                = "${local.nome_base}-erros-5xx"
  resource_group_name = azurerm_resource_group.principal.name
  scopes              = [azurerm_linux_web_app.api[0].id]
  description         = "Erros 5xx acima do limite"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10
  }

  action {
    action_group_id = azurerm_monitor_action_group.principal[0].id
  }

  tags = local.tags
}

resource "azurerm_monitor_metric_alert" "banco_cpu" {
  count = var.habilitar_alarmes && !var.modo_local ? 1 : 0

  name                = "${local.nome_base}-cpu-banco"
  resource_group_name = azurerm_resource_group.principal.name
  scopes              = [azurerm_postgresql_flexible_server.banco.id]
  description         = "Uso de CPU do PostgreSQL acima do limite"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.principal[0].id
  }

  tags = local.tags
}
