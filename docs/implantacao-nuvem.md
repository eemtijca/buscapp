# Implantação em nuvem

O projeto pode ser implantado na AWS, no Azure ou no GCP com Terraform, além da Vercel. Cada nuvem tem um módulo raiz independente em `infra/terraform/<nuvem>`, com dois modos:

- `modo_local = true`: usa os emuladores do Floci, recursos mínimos e as imagens locais. Serve para testar o Terraform e a aplicação sem conta em nuvem.
- `modo_local = false`: caminho de produção, com serviços gerenciados, criptografia, backups, identificadores e segredos write-only.

O [ADR-015](adr/015-implantacao-multinuvem.md) registra a decisão.

## Arquitetura por nuvem

| Camada | AWS | Azure | GCP |
| --- | --- | --- | --- |
| Computação | ECS Fargate atrás de ALB | App Service (produção) e Container Apps (modo local) | Cloud Run v2 |
| Banco | RDS PostgreSQL 17 | PostgreSQL Flexible Server | Cloud SQL PostgreSQL |
| Cache do SSE | ElastiCache Valkey | Azure Managed Redis (produção) | Memorystore opcional |
| Anexos | S3 privado | Blob Storage privado | GCS privado com chaves HMAC |
| Segredos | Secrets Manager | Key Vault | Secret Manager |
| Registro de imagens | ECR | Azure Container Registry | Artifact Registry |
| Observabilidade | CloudWatch Logs e alarmes | Log Analytics e alertas | Cloud Logging e alerta de 5xx |
| Rede | VPC com sub-redes públicas e privadas | VNet com sub-redes delegadas | VPC com egress direto e Cloud SQL privado |

O barramento de eventos usa Redis quando existe e cai para `LISTEN/NOTIFY` do PostgreSQL quando a variável `REDIS_URL` não é informada. No modo local do Azure o cache não é provisionado e vale o fallback.

## Pré-requisitos

- Terraform 1.11 ou superior.
- Docker com Compose.
- Floci CLI e emuladores (`floci`, `floci-az` e `floci-gcp`).
- AWS CLI, Azure CLI e gcloud apenas para inspeção manual; os scripts usam `curl` e o próprio Terraform.
- Node 20.19 ou superior para construir a imagem da aplicação.

## Estrutura

```text
infra/
  floci/
    compose.floci.yml   # emuladores usados nos testes locais e no CI
    testar.sh           # ciclo completo por nuvem
  terraform/
    validar.sh          # init sem backend e validate nas três nuvens
    aws/
    azure/
    gcp/
```

Cada módulo tem `versions.tf`, `providers.tf`, `variables.tf`, `locals.tf`, os recursos separados por assunto, `outputs.tf` e os exemplos `terraform.tfvars.example`, `terraform.tfvars.local.example` e `backend.hcl.example` em cada nuvem. Os arquivos `.tfvars` reais não são versionados.

## Comandos

```bash
npm run infra:fmt        # formata todos os módulos
npm run infra:validar    # init sem backend e validate nas três nuvens
npm run infra:floci      # aplica e destrói nas três nuvens pelo Floci
npm run infra:floci:aws  # apenas AWS
npm run infra:floci:azure
npm run infra:floci:gcp
```

O script `infra/floci/testar.sh` constrói a imagem `buscapp-api:local` quando necessário, sobe os emuladores quando as portas padrão não respondem, aplica o Terraform, confere `GET /api/saude` e `GET /api/saude/pronto` e destrói os recursos. Use `MANTER=true` para preservar o ambiente após o teste.

## Modo de produção

1. Publique a imagem no registro da nuvem e informe `imagem_aplicacao`.
2. Copie `terraform.tfvars.example` para `terraform.tfvars` e ajuste os valores. Na AWS, informe também `certificado_arn`; o balanceador só encaminha HTTP na ausência do certificado no modo local.
3. Configure o backend remoto. Cada nuvem tem um exemplo em `backend.hcl.example`: na AWS com bucket versionado, criptografia e lockfile; no Azure com conta de armazenamento e autenticação do Entra ID; no GCP com bucket versionado.
4. Rode `terraform init` e `terraform plan` e revise o plano antes de aplicar. O repositório não aplica em produção por conta própria.

Segredos como a senha do banco e o `AUTH_PEPPER` nascem de valores efêmeros e chegam aos cofres por argumentos write-only, sem registro no state. O caminho de produção de cada nuvem foi validado por `terraform validate`; os testes automatizados cobrem o modo local.

## Migrações

O entrypoint do contêiner aguarda o banco, aplica as migrações do Prisma e prepara o papel `buscapp_api` antes de subir a API. Em mais de uma réplica as migrações podem competir; o Prisma e o papel usam travas próprias, mas o primeiro deploy deve acontecer com uma réplica antes de escalar.

## Agendador do expurgo

A rota `POST /api/tarefas/expurgo` aplica a retenção de anexos, códigos, sessões e contadores e exige `Authorization: Bearer CRON_SECRET`. Sem o segredo configurado a rota responde 404; com segredo inválido, 403.

O workflow `expurgo.yml` dispara a rota todos os dias às 4h (UTC) e também aceita execução manual. Configure o segredo `CRON_SECRET` no repositório e, se quiser apontar para outro endereço, a variável `EXPURGO_APP_URL` (o padrão é o endereço publicado na Vercel).

Em implantações na nuvem, a mesma chamada pode ser feita por um agendador nativo:

- AWS: EventBridge Scheduler com uma função Lambda que faz a requisição HTTP, ou uma tarefa agendada do ECS.
- Azure: um job agendado do Container Apps ou um fluxo do Logic Apps.
- GCP: Cloud Scheduler com destino HTTP.

## Limites do modo local

- A AWS não cria ECR e o Azure não cria ACR no modo local, porque o emulador mantém o registro de apoio inalcançável após a primeira operação e a exclusão do recurso não conclui.
- O ECS emulado não injeta segredos do Secrets Manager; no modo local as variáveis vão no ambiente da tarefa, com valores de desenvolvimento.
- O Key Vault e o Log Analytics ficam restritos à produção no Azure: o emulador não responde ao data plane de certificados nem à listagem de workspaces excluídos.
- O Container Apps emulado exige `FLOCI_AZ_SERVICES_CONTAINER_APPS_MOCKED=false` e TLS, configuração já presente em `compose.floci.yml`.
- O contêiner de anexos do Blob é criado pelo script de teste no modo local, porque a exclusão no emulador não tem efeito.
- O Cloud Run emulado usa a imagem local; o Artifact Registry existe apenas em produção.
- O Redis não é provisionado no modo local do Azure; o SSE usa o fallback do PostgreSQL.

## Segurança

- Nenhum segredo é versionado em `tfvars`; os valores de produção são gerados pelo Terraform e gravados em cofres por argumentos write-only.
- O bucket de anexos não aceita acesso público; o download continua passando pela API.
- As tarefas e o banco ficam em sub-redes privadas, com grupos de segurança encadeados e sem portas de banco expostas.
- As roles seguem o menor privilégio, com escopo nos recursos criados pelo módulo.
- O domínio próprio é opcional. Sem ele, o TLS usa os endpoints gerenciados de cada plataforma. Na AWS o alias é criado no Route 53 quando `dominio` e `zona_hospedada_id` são informados, junto do `certificado_arn` validado. No Azure e no GCP o binding do hostname com certificado gerenciado acontece fora do Terraform; nesses dois provedores a variável `dominio` apenas compõe o `APP_URL` e deve ser preenchida depois do binding.
