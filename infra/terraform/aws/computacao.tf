# Roles, cluster, definição e serviço ECS, balanceador e listeners.

resource "aws_iam_role" "execucao" {
  name = "${local.nome_base}-execucao"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(local.tags, { Name = "${local.nome_base}-execucao" })
}

resource "aws_iam_role_policy_attachment" "execucao_ecs" {
  role       = aws_iam_role.execucao.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execucao_segredos" {
  name = "${local.nome_base}-execucao-segredos"
  role = aws_iam_role.execucao.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.migrate_database_url.arn,
        aws_secretsmanager_secret.app_db_password.arn,
        aws_secretsmanager_secret.auth_pepper.arn,
        aws_secretsmanager_secret.cron.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "tarefa" {
  name = "${local.nome_base}-tarefa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(local.tags, { Name = "${local.nome_base}-tarefa" })
}

resource "aws_iam_role_policy" "tarefa_anexos" {
  name = "${local.nome_base}-tarefa-anexos"
  role = aws_iam_role.tarefa.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.anexos.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.anexos.arn}/*"]
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.nome_base}"
  retention_in_days = var.retencao_logs_dias

  tags = merge(local.tags, { Name = "/ecs/${local.nome_base}" })
}

resource "aws_ecs_cluster" "api" {
  name = local.nome_base

  tags = merge(local.tags, { Name = local.nome_base })
}

resource "aws_ecs_task_definition" "api" {
  family                   = local.nome_base
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.cpu_tarefa)
  memory                   = tostring(var.memoria_tarefa)
  execution_role_arn       = aws_iam_role.execucao.arn
  task_role_arn            = aws_iam_role.tarefa.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.imagem_aplicacao
      essential = true

      portMappings = [{
        containerPort = 3000
        hostPort      = 3000
        protocol      = "tcp"
      }]

      environment = concat(
        [
          { name = "NODE_ENV", value = "production" },
          { name = "PORT", value = "3000" },
          { name = "HOST", value = "0.0.0.0" },
          { name = "TZ_ESCOLA", value = var.tz_escola },
          { name = "APP_URL", value = local.url_aplicacao },
          { name = "TRUST_PROXY", value = "true" },
          { name = "COOKIE_SECURE", value = var.modo_local ? "false" : "true" },
          { name = "DB_POOL_MAX", value = "10" },
          { name = "STORAGE_DRIVER", value = var.modo_local ? "disco" : "s3" },
          { name = "S3_REGION", value = var.regiao },
        ],
        var.modo_local ? [] : [
          { name = "S3_BUCKET", value = aws_s3_bucket.anexos.bucket },
        ],
        var.modo_local ? [
          { name = "DATABASE_URL", value = local.url_aplicacao_banco_local },
          { name = "MIGRATE_DATABASE_URL", value = local.url_migracao_local },
          { name = "APP_DB_PASSWORD", value = var.senha_app_local },
          { name = "REDIS_URL", value = local.url_cache },
          { name = "AUTH_PEPPER", value = var.auth_pepper_local },
          { name = "CRON_SECRET", value = var.cron_secret_local },
        ] : [],
        var.modo_local ? [] : [
          { name = "REDIS_URL", value = local.url_cache },
        ],
      )

      secrets = var.modo_local ? [] : [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "MIGRATE_DATABASE_URL", valueFrom = aws_secretsmanager_secret.migrate_database_url.arn },
        { name = "APP_DB_PASSWORD", valueFrom = aws_secretsmanager_secret.app_db_password.arn },
        { name = "AUTH_PEPPER", valueFrom = aws_secretsmanager_secret.auth_pepper.arn },
        { name = "CRON_SECRET", valueFrom = aws_secretsmanager_secret.cron.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.regiao
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])

  tags = merge(local.tags, { Name = local.nome_base })
}

resource "aws_lb" "principal" {
  name               = "${local.nome_base}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.publica[*].id

  enable_deletion_protection = var.modo_local ? false : true

  tags = merge(local.tags, { Name = "${local.nome_base}-alb" })
}

resource "aws_lb_target_group" "api" {
  name        = "${local.nome_base}-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.principal.id
  target_type = "ip"

  health_check {
    path                = "/api/saude"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(local.tags, { Name = "${local.nome_base}-api" })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.principal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = var.modo_local ? "forward" : "redirect"
    target_group_arn = var.modo_local ? aws_lb_target_group.api.arn : null

    dynamic "redirect" {
      for_each = var.modo_local ? [] : [1]

      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  lifecycle {
    precondition {
      condition     = var.modo_local || var.certificado_arn != null
      error_message = "Fora do modo local, informe certificado_arn: o balanceador público não encaminha HTTP sem TLS."
    }
  }

  tags = merge(local.tags, { Name = "${local.nome_base}-http" })
}

resource "aws_lb_listener" "https" {
  count = var.certificado_arn == null ? 0 : 1

  load_balancer_arn = aws_lb.principal.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificado_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = merge(local.tags, { Name = "${local.nome_base}-https" })
}

resource "aws_ecs_service" "api" {
  name            = local.nome_base
  cluster         = aws_ecs_cluster.api.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = local.contagem_tarefas
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.privada[*].id
    security_groups  = [aws_security_group.tarefas.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  health_check_grace_period_seconds = 60
  wait_for_steady_state             = var.modo_local ? false : true

  tags = merge(local.tags, { Name = local.nome_base })

  depends_on = [aws_lb_listener.http]
}

resource "aws_route53_record" "api" {
  count = var.dominio != null && var.zona_hospedada_id != null ? 1 : 0

  zone_id = var.zona_hospedada_id
  name    = var.dominio
  type    = "A"

  alias {
    name                   = aws_lb.principal.dns_name
    zone_id                = aws_lb.principal.zone_id
    evaluate_target_health = true
  }
}
