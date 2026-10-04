# VPC dedicada com sub-redes públicas para o ALB e privadas para as tarefas,
# o banco e o cache.

resource "aws_vpc" "principal" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, { Name = "${local.nome_base}-vpc" })
}

resource "aws_subnet" "publica" {
  count                   = 2
  vpc_id                  = aws_vpc.principal.id
  cidr_block              = local.subredes_publicas[count.index]
  availability_zone       = local.zonas[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, { Name = "${local.nome_base}-publica-${count.index + 1}" })
}

resource "aws_subnet" "privada" {
  count             = 2
  vpc_id            = aws_vpc.principal.id
  cidr_block        = local.subredes_privadas[count.index]
  availability_zone = local.zonas[count.index]

  tags = merge(local.tags, { Name = "${local.nome_base}-privada-${count.index + 1}" })
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-igw" })
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = merge(local.tags, { Name = "${local.nome_base}-rotas-publicas" })
}

resource "aws_route_table_association" "publica" {
  count          = 2
  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

resource "aws_eip" "nat" {
  count  = local.habilitar_nat ? 1 : 0
  domain = "vpc"

  tags = merge(local.tags, { Name = "${local.nome_base}-eip-nat" })
}

resource "aws_nat_gateway" "principal" {
  count         = local.habilitar_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.publica[0].id

  tags = merge(local.tags, { Name = "${local.nome_base}-nat" })
}

resource "aws_route_table" "privada" {
  vpc_id = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-rotas-privadas" })
}

resource "aws_route" "saida_privada" {
  count                  = local.habilitar_nat ? 1 : 0
  route_table_id         = aws_route_table.privada.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.principal[0].id
}

resource "aws_route_table_association" "privada" {
  count          = 2
  subnet_id      = aws_subnet.privada[count.index].id
  route_table_id = aws_route_table.privada.id
}

# O ALB aceita tráfego público e só encaminha para as tarefas na porta da API.
resource "aws_security_group" "alb" {
  name        = "${local.nome_base}-alb"
  description = "Entrada publica do balanceador"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP publico"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS publico"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_para_tarefas" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Saida para a API"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.tarefas.id
}

# As tarefas só aceitam conexões vindas do balanceador.
resource "aws_security_group" "tarefas" {
  name        = "${local.nome_base}-tarefas"
  description = "Tarefas da API"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-tarefas" })
}

resource "aws_vpc_security_group_ingress_rule" "tarefas_api" {
  security_group_id            = aws_security_group.tarefas.id
  description                  = "API vinda do balanceador"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "tarefas_saida" {
  security_group_id = aws_security_group.tarefas.id
  description       = "Saida para banco, cache, registries e logs"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "banco" {
  name        = "${local.nome_base}-banco"
  description = "PostgreSQL gerenciado"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-banco" })
}

resource "aws_vpc_security_group_ingress_rule" "banco_api" {
  security_group_id            = aws_security_group.banco.id
  description                  = "PostgreSQL vindo da API"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.tarefas.id
}

resource "aws_security_group" "cache" {
  name        = "${local.nome_base}-cache"
  description = "Cache do barramento de eventos"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nome_base}-cache" })
}

resource "aws_vpc_security_group_ingress_rule" "cache_api" {
  security_group_id            = aws_security_group.cache.id
  description                  = "Redis vindo da API"
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.tarefas.id
}
