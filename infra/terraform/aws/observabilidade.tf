# Alarmes essenciais. Em produção recebem um tópico SNS com os e-mails
# informados; no modo local ficam desligados pelo tfvars.

resource "aws_sns_topic" "alarmes" {
  count = var.habilitar_alarmes ? 1 : 0
  name  = "${local.nome_base}-alarmes"

  tags = merge(local.tags, { Name = "${local.nome_base}-alarmes" })
}

resource "aws_sns_topic_subscription" "email" {
  for_each = var.habilitar_alarmes ? toset(var.emails_alarme) : toset([])

  topic_arn = aws_sns_topic.alarmes[0].arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "erros_api" {
  count = var.habilitar_alarmes ? 1 : 0

  alarm_name          = "${local.nome_base}-erros-5xx"
  alarm_description   = "Erros 5xx acima do limite no balanceador"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.principal.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }

  alarm_actions = var.habilitar_alarmes ? [aws_sns_topic.alarmes[0].arn] : []
  ok_actions    = var.habilitar_alarmes ? [aws_sns_topic.alarmes[0].arn] : []

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_tarefas" {
  count = var.habilitar_alarmes ? 1 : 0

  alarm_name          = "${local.nome_base}-cpu-tarefas"
  alarm_description   = "Uso de CPU do serviço acima do limite"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.api.name
    ServiceName = aws_ecs_service.api.name
  }

  alarm_actions = var.habilitar_alarmes ? [aws_sns_topic.alarmes[0].arn] : []

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_banco" {
  count = var.habilitar_alarmes ? 1 : 0

  alarm_name          = "${local.nome_base}-cpu-banco"
  alarm_description   = "Uso de CPU do banco acima do limite"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.banco.identifier
  }

  alarm_actions = var.habilitar_alarmes ? [aws_sns_topic.alarmes[0].arn] : []

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "armazenamento_banco" {
  count = var.habilitar_alarmes ? 1 : 0

  alarm_name          = "${local.nome_base}-armazenamento-banco"
  alarm_description   = "Espaço livre do banco abaixo do limite"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 2147483648
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.banco.identifier
  }

  alarm_actions = var.habilitar_alarmes ? [aws_sns_topic.alarmes[0].arn] : []

  tags = local.tags
}
