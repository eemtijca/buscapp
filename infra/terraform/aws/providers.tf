# No modo local os serviços apontam para o emulador Floci; na nuvem real os
# endpoints ficam nulos e o provider usa os endereços oficiais.

provider "aws" {
  region = var.regiao

  access_key                  = var.modo_local ? "test" : null
  secret_key                  = var.modo_local ? "test" : null
  skip_credentials_validation = var.modo_local
  skip_metadata_api_check     = var.modo_local
  skip_requesting_account_id  = var.modo_local
  s3_use_path_style           = var.modo_local

  endpoints {
    acm                    = var.modo_local ? local.endpoint_floci : null
    applicationautoscaling = var.modo_local ? local.endpoint_floci : null
    autoscaling            = var.modo_local ? local.endpoint_floci : null
    cloudwatch             = var.modo_local ? local.endpoint_floci : null
    ec2                    = var.modo_local ? local.endpoint_floci : null
    ecr                    = var.modo_local ? local.endpoint_floci : null
    ecs                    = var.modo_local ? local.endpoint_floci : null
    elasticache            = var.modo_local ? local.endpoint_floci : null
    elasticloadbalancing   = var.modo_local ? local.endpoint_floci : null
    iam                    = var.modo_local ? local.endpoint_floci : null
    kms                    = var.modo_local ? local.endpoint_floci : null
    logs                   = var.modo_local ? local.endpoint_floci : null
    rds                    = var.modo_local ? local.endpoint_floci : null
    route53                = var.modo_local ? local.endpoint_floci : null
    s3                     = var.modo_local ? local.endpoint_floci : null
    secretsmanager         = var.modo_local ? local.endpoint_floci : null
    sns                    = var.modo_local ? local.endpoint_floci : null
    sts                    = var.modo_local ? local.endpoint_floci : null
  }
}
