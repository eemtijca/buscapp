# Banco

PostgreSQL 15 ou superior com Prisma 7.10. O schema fica em `apps/api/prisma/schema.prisma`, as migrações em `apps/api/prisma/migrations/` e a configuração do CLI em `apps/api/prisma.config.ts`. O runtime usa `DATABASE_URL` com o papel restrito; migrações, seed e rotinas administrativas usam `MIGRATE_DATABASE_URL` com o dono do schema.

A descrição das entidades e do vocabulário do domínio está em [modelo-de-dados.md](modelo-de-dados.md).

## Comandos

```bash
npm run db:generate                # regenera o Prisma Client
npm run db:migrate                 # aplica as migrações (prisma migrate deploy)
npm run -w @buscapp/api generate   # alias de db:generate
npm run seed -w @buscapp/api       # fixtures de desenvolvimento
npm run test:db                    # smoke test do schema no Compose
```

Comandos diretos úteis, executados em `apps/api`:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate dev --name ajuste
npx prisma studio
```

Nunca edite uma migração já aplicada. Crie uma nova com `prisma migrate dev`.

## Migrações

| Migração                                 | Conteúdo                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `20260913000000_baseline`                | 31 tabelas de domínio, 14 enums, índices, FKs, CHECKs, `pgcrypto` e `pg_trgm`. |
| `20260913000100_autenticacao`            | `perfis.senha_hash`, tabela `sessoes` e `codigos_redefinicao.codigo_hash`.     |
| `20260913000200_dados_canonicos`         | Configuração inicial, catálogos, horários, tags, disciplinas e ano letivo.     |
| `20260913000300_rotinas_dominio`         | Funções e triggers de domínio.                                                 |
| `20260913000400_rls_backstop`            | Papel `buscapp_api`, funções auxiliares e políticas RLS.                       |
| `20260913000500_corrige_politica_anexos` | Correção da política de leitura de `anexos`.                                   |
| `20260920215818_rate_limit_contadores`   | Tabela de contadores do rate limiting.                                         |
| `20260920223000_integridade_anos_anexos_codigos` | Unicidade do ano ativo, do `storage_path` e do código ativo; triggers de enturmação. |
| `20260920224500_indices_catalogos`       | Índices B-tree e GIN para contagens de catálogo.                               |
| `20260920230000_rls_tabelas_administrativas` | RLS e privilégios de coluna em `perfis`, `configuracoes_sistema`, `auditoria` e `codigos_redefinicao`. |
| `20260920231500_dedupe_notificacoes`     | `notificacoes.dedupe_key` e índice único parcial por pendência.                |

O container aplica as migrações na partida pelo entrypoint. Em produção, o workflow `migracoes.yml` aplica e em seguida define a senha do papel. Ver [deploy.md](deploy.md).

## Papéis e RLS

- O dono do schema (`postgres` no Supabase, `buscapp` no Compose) é usado por migrações, seed, fixtures e pelas rotinas administrativas da API (tabelas `sessoes`, `codigos_redefinicao` e `codigos_redefinicao_tentativas`, por exemplo). O dono não sofre RLS.
- O papel `buscapp_api` é criado pela migração de backstop com `login` e sem `bypassrls`. Recebe permissões nas tabelas, sequências e funções auxiliares. A senha nunca fica na migração: é aplicada por `infra/docker/role.mjs` a partir de `APP_DB_PASSWORD`.
- A API usa `DATABASE_URL` com `buscapp_api`. Cada operação de modelo roda em uma transação curta que executa `select set_config('app.usuario_id', $1, true)`, permitindo que as políticas leiam o usuário da requisição. O helper `comEscopo()` faz o mesmo em transações explícitas.
- As funções auxiliares (`app_usuario_id`, `app_papel`, `app_modulos`, `app_is_gestao`, `app_professor_da_turma` e `app_aluno_visivel`) são `security definer` e concentram as regras das políticas.
- Tabelas com RLS e políticas: `alunos`, `enturmacoes`, `vinculos_responsaveis`, `frequencias`, `registros_comportamento`, `registro_comportamento_tags`, `ocorrencias`, `ocorrencia_anexos`, `justificativas_faltas`, `justificativa_anexos`, `anexos`, `conversas`, `mensagens`, `notificacoes`, `turmas`, `disciplinas`, `anos_letivos`, `atribuicoes_professores`, `opcoes_configuracao`, `horarios_letivos`, `tags_comportamento`, `monitoramento_acoes`, `pontuacao_turmas`, `importacoes_log`, `exportacoes` e `convites`.
- `sessoes` tem RLS habilitado sem política, de propósito: o acesso é feito pelo cliente administrativo.
- `perfis`, `auditoria`, `codigos_redefinicao`, `codigos_redefinicao_tentativas` e `configuracoes_sistema` também usam o cliente administrativo nos fluxos de autenticação e auditoria. Desde o ADR-009, `perfis`, `configuracoes_sistema`, `auditoria` e `codigos_redefinicao` têm RLS (leitura autenticada e escrita da gestão), e o papel de runtime não lê `senha_hash` por privilégio de coluna.

A autorização efetiva é a camada de serviços da API; a RLS é a segunda barreira. Ver [seguranca.md](seguranca.md) e [ADR-003](adr/003-rls-backstop.md).

## Funções e triggers

Funções de domínio:

- `fn_auto_justificar_frequencias`: ao aceitar uma justificativa, marca as frequências do aluno no período como justificadas.
- `fn_notificar_nova_mensagem` (security definer): cria notificações a cada mensagem e reabre conversas ocultas.
- `fn_notificar_ocorrencia` (security definer): notifica os responsáveis vinculados quando a ocorrência pede notificação.
- `fn_set_turma_nome`: preenche `turmas.nome_completo` a partir de série e letra.
- `fn_set_updated_at`: mantém `updated_at` nas tabelas que o possuem.
- `fn_chave_catalogo_valida`, `fn_chaves_catalogo_validas` e `fn_tags_validas`: validam chaves de catálogo e tags nas restrições CHECK.

São 29 triggers, incluindo os quatro de domínio e o `trg_set_updated_at` presente nas tabelas com `updated_at`.

## Índices

- `idx_alunos_nome_trgm`: GIN com trigrama para busca por nome.
- `idx_frequencias_unicidade`: unicidade parcial por aluno, data, tipo, período e disciplina quando `deleted_at is null`.
- `idx_anexos_expurgo`: parcial para anexos ainda não expurgados.
- Índices parciais de status ativo e de idempotência por `client_request_id` em frequências, mensagens e registros de comportamento.
- `idx_pontuacao_ranking`: ranking mensal por turma.

## Seeds

`apps/api/prisma/seeds/dev.ts` é idempotente e usa UUIDs canônicos compartilhados com `tests/suporte/dados.ts`. Cria 7 perfis, 1 ano letivo, 3 turmas, 9 alunos, enturmações, atribuições, vínculos, 120 frequências, ocorrências, notificações, códigos de redefinição e ações de monitoramento. As senhas vêm de `SEED_SENHA_*`. Os códigos de exemplo são gravados apenas como HMAC, coerentes com o fluxo real.

## Retenção

A retenção é aplicada por `POST /api/tarefas/expurgo`, autenticado por `CRON_SECRET` e agendado externamente (Vercel Cron ou GitHub Actions):

- Anexos vencidos têm o objeto removido do storage e o registro excluído; `dias_expurgo_anexos` define a data de expurgo na criação.
- Códigos usados, revogados ou expirados além de `dias_retencao_codigos` são removidos, junto das tentativas antigas.
- Sessões encerradas ou expiradas há mais de 7 dias são removidas.
- Contadores de rate limiting expirados são removidos.
- Frequências usam soft delete (`deleted_at`); mensagens têm `deleted_at` e `edited_at`.

O servidor não possui cron nem `pg_cron`. Qualquer rotina de expurgo futuro deve ser agendado externamente. Ver [operacao.md](operacao.md).

## Integridade

Restrições CHECK validam chaves de `opcoes_configuracao` e nomes de `tags_comportamento` nas tabelas que as referenciam, além de limites de score, ordem de datas, tamanho de anexo, mensagens não vazias e capacidade de turma. A exclusão de turmas com conversas ou atribuições é bloqueada por `ON DELETE RESTRICT`.
