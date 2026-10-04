# Registro de imagens. No modo local a imagem vem do Docker da máquina, então o
# repositório não é criado (o emulador também não conclui a exclusão de ECR).

resource "aws_ecr_repository" "api" {
  count = var.modo_local ? 0 : 1

  name                 = local.nome_base
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, { Name = local.nome_base })
}

resource "aws_ecr_lifecycle_policy" "api" {
  count      = var.modo_local ? 0 : 1
  repository = aws_ecr_repository.api[0].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expira imagens sem tag"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Mantém as dez imagens com tag mais recentes"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}
