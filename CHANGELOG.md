# Changelog

Todas as mudanças relevantes deste projeto são registradas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Enquanto a primeira versão pública não é lançada, a versão do projeto permanece fixada em `0.1.0`. A primeira release será a `v1.0.0`.

## [Não publicado]

### Adicionado

- AGENTS.md com orientações para agentes de IA.
- Guia de contribuição ampliado com fluxo de issues, convenções de commit e pull request, política de revisão, releases e contribuições assistidas por IA.
- README reestruturado no padrão de repositórios de referência, com selos, sumário, demonstração, arquitetura, FAQ, suporte e créditos.
- Spec `tests/e2e/imagens.spec.ts` e comandos `capturas:readme` para gerar as capturas versionadas em `docs/imagens/`.
- Catálogo de etiquetas em `.github/labels.json` e script `npm run etiquetas:sync` para sincronizá-las pelo GitHub CLI.
- Workflow `etiquetas.yml`, que aplica etiquetas de área pelos caminhos e de tipo pelo título e valida título e etiquetas em pull requests.
- Templates de issue ampliados (Bug, Melhoria e Tarefa) e template de pull request com etiquetas, commits atômicos, ciclo de rascunho e uso de IA.
- Guarda editorial em `tests/unit/texto-editorial.test.ts`, com o script `npm run test:texto`.
- Script de execução do Playwright em contêiner e scripts npm correspondentes.
- CHANGELOG.md e seção de releases no guia de contribuição.
- GitHub CLI no devcontainer.
- Módulos Terraform para AWS, Azure e GCP em `infra/terraform`, com modo local apoiado nos emuladores do Floci e modo de produção com serviços gerenciados.
- Driver de armazenamento `azure-blob`, com connection string ou identidade gerenciada.
- Redis opcional no barramento de eventos, que passa a usar o `LISTEN/NOTIFY` do PostgreSQL quando `REDIS_URL` não é informada.
- Harness `infra/floci` com Compose dos emuladores e script de aplicação, verificação e destruição por nuvem.
- Workflow `infra.yml` para formatar, validar e aplicar o Terraform no Floci.
- Documento `docs/implantacao-nuvem.md` e ADR-015 sobre a implantação multicloud.
- Workflow `expurgo.yml` que dispara a purga de retenção diária com `CRON_SECRET`.
- Documentação interativa da API em `GET /api/docs`, com especificação OpenAPI 3.1 gerada dos schemas Zod das rotas, `operationId` e descrição em cada operação, respostas de erro com exemplos do envelope e esquema de segurança por cookie.
- Lint da especificação OpenAPI com Redocly CLI (`pnpm run openapi:lint`) no workflow de testes, com o ruleset em `redocly.yaml`.
- Índice `apps/web/public/llms.txt` para agentes de IA, com o contrato, a referência e a orientação de uso seguro.
- ADR-016 sobre a documentação interativa e o CSP por URL.

### Corrigido

- A suíte de ponta a ponta volta a rodar: a imagem oficial do Playwright sobe para a v1.64.0, alinhada à versão do `@playwright/test` instalada, o script repassa `API_URL` ao contêiner quando definida e os testes de cópia concedem a permissão no endereço configurado, para rodar contra o aplicativo do Compose.

- Compose define `APP_URL` como `http://localhost:3000`, corrigindo o login e as mutações na mesma origem servida pelo contêiner.

### Modificado

- Monorepo migrado de npm workspaces para pnpm, com `packageManager` fixado, `pnpm-lock.yaml` versionado, `pnpm-workspace.yaml` para os pacotes e scripts de build, `workspace:*` nos contratos, Dockerfile e workflows ajustados e `pnpm exec`/`pnpm dlx` no lugar de `npx`.
- Guia de contribuição e AGENTS.md passam a exigir etiquetas em issues e pull requests, commits atômicos organizados em um único pull request e abertura somente com o trabalho finalizado.
- Textos de interface, mensagens e documentação ajustados à convenção editorial, com pluralização correta e sem segunda pessoa.
- Nomes exibidos dos workflows alinhados ao padrão em português.
- Referências da arquitetura e dos testes atualizadas.
- CSP passa a ser aplicado por URL: `script-src 'self'` em toda a API e `'unsafe-eval'` apenas nas rotas da documentação interativa, exigido pela validação do "Try it out".
- Documentação interativa degrada para uma página mínima em runtimes sem `require` de módulos ESM, quando o Swagger UI não pode ser carregado; a especificação segue publicada.
- Contrato de auditoria usa `z.unknown()` sem `nullable()` extra, que gerava um `anyOf` vazio no JSON Schema.
