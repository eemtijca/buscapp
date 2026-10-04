# ADR-015: implantação em AWS, Azure e GCP com Terraform

## Status

Aceita.

## Contexto

O produto já era publicado na Vercel, com o perfil serverless documentado em `docs/deploy.md` e `docs/operacao.md`. Surgiu a necessidade de oferecer uma segunda opção de implantação que rode a mesma aplicação em nuvens tradicionais, com infraestrutura declarativa e testável sem custo de nuvem.

## Decisão

Cada nuvem ganhou um módulo raiz de Terraform em `infra/terraform/<nuvem>`, parametrizado por `modo_local`. No modo local os recursos apontam para os emuladores do Floci e usam valores de desenvolvimento; fora dele valem os serviços gerenciados, com criptografia, backups e segredos write-only.

O alvo de computação é ECS Fargate na AWS, App Service no Azure em produção e Container Apps no modo local, e Cloud Run no GCP. O banco é sempre PostgreSQL gerenciado. O cache do SSE é opcional, com fallback para `LISTEN/NOTIFY` do PostgreSQL quando não existe Redis. Os anexos usam S3, Blob Storage ou GCS, e a aplicação ganhou o driver `azure-blob` para falar com o Azure de forma nativa.

O ciclo local e de integração contínua usa `infra/floci/compose.floci.yml` e `infra/floci/testar.sh`, que aplicam e destroem cada nuvem no emulador e conferem as sondas de saúde.

## Consequências

- A Vercel continua sendo a opção padrão documentada; a nuvem tradicional é uma alternativa.
- O caminho de produção depende de recursos que o emulador não cobre, como App Service, Key Vault e Artifact Registry, validados por `terraform validate` e não pelo Floci.
- O modo local tem limites registrados em `docs/implantacao-nuvem.md`, como a ausência de ECR e ACR e a injeção de segredos no ECS emulado.
- Rotação automática das senhas do banco fica como evolução; a troca acontece ao incrementar `versao_segredos`.
