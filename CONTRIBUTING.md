# Contribuindo

Guia de desenvolvimento do BuscApp: como preparar o ambiente, abrir issues, propor mudanças, escrever código, testar e documentar. Dúvidas e propostas podem ser abertas como issue; o detalhamento técnico está em [docs/](docs/README.md). Para vulnerabilidades, siga [SECURITY.md](SECURITY.md), e para a convivência, o [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Antes de começar

- Abra uma issue antes de trabalhar em funcionalidades, mudanças estruturais e correções grandes. Ajustes pequenos e evidentes podem seguir direto para um pull request.
- Procure issues abertas e fechadas antes de criar uma nova. Havendo uma equivalente, comente para assumir a tarefa e evitar trabalho duplicado.
- Aplique as etiquetas de tipo e de área em toda issue e todo pull request, conforme a seção [Etiquetas](#etiquetas).
- Descreva o contexto com clareza: passos de reprodução, comportamento observado, comportamento esperado e versão ou commit afetado.
- Mantenha a conversa pública nas issues e nos pull requests. Canais privados ficam reservados para vulnerabilidades e assuntos de conduta.
- Nunca inclua segredos, credenciais, dados reais de alunos, responsáveis ou professores em issues, comandos, commits, capturas ou logs.
- Vulnerabilidades seguem [SECURITY.md](SECURITY.md), nunca uma issue pública.

## Ambiente de desenvolvimento

Pré-requisitos: Node 20.19 ou superior (ou 22.12 ou superior) e Docker com Compose. Também é possível usar um PostgreSQL 15 ou superior próprio, conforme [docs/ambiente.md](docs/ambiente.md).

```bash
npm install
cp .env.example .env  # preencha AUTH_PEPPER com pelo menos 32 caracteres
npm run compose:up
npm run seed -w @buscapp/api
npm run dev:web       # SPA em http://localhost:5173
npm run dev:api       # API em http://localhost:3001
```

O Compose sobe a aplicação em `http://localhost:3000` com o PostgreSQL em `localhost:5433`. As credenciais de desenvolvimento estão em [docs/ambiente.md](docs/ambiente.md).

Comandos úteis na raiz:

| Comando                               | Efeito                                         |
| ------------------------------------- | ---------------------------------------------- |
| `npm run compose:up`                  | Sobe a aplicação e o banco via Docker Compose. |
| `npm run compose:down`                | Derruba o ambiente.                            |
| `npm run dev:web` / `npm run dev:api` | Servidores de desenvolvimento isolados.        |
| `npm run seed -w @buscapp/api`        | Semeia dados de desenvolvimento.               |
| `npm run db:generate`                 | Regenera o cliente Prisma.                     |
| `npm run db:migrate`                  | Aplica as migrações pendentes.                 |
| `npm run test:texto`                  | Confere a convenção editorial do repositório.  |
| `npm run format`                      | Roda o Prettier nos diretórios de código.      |
| `npm run etiquetas:sync`              | Sincroniza as etiquetas com o catálogo do GitHub. |

Cada workspace declara no próprio `package.json` as ferramentas de build que seus scripts usam, para que o install filtrado por serviço funcione sem depender do hoisting do root.

## Fluxo de contribuição e pull requests

### GitHub CLI

Opere issues, pull requests, execuções de workflow e releases pelo GitHub CLI (`gh`), não pela interface web. Antes de operar, confirme a sessão com `gh auth status` (ou `gh status`) e, se não houver conexão, autentique com `gh auth login`.

Comandos do dia a dia:

- `gh issue create`, `gh issue list` e `gh issue view` para issues.
- `gh pr create`, `gh pr view` e `gh pr checks --watch` para pull requests.
- `gh pr edit <número> --add-label <etiqueta>` para corrigir etiquetas.
- `gh run list`, `gh run watch` e `gh run view --log-failed` para workflows.
- `gh release create` e `gh release view` para releases.

Nunca inclua segredos, credenciais ou dados de alunos em comandos, títulos, corpos ou comentários.

### Issues

Abra uma issue quando:

- encontrar um comportamento incorreto que não consegue corrigir;
- propor uma funcionalidade ou melhoria de escopo;
- discutir uma decisão estrutural ou de arquitetura;
- apontar falha ou lacuna de documentação.

Antes de abrir, procure issues abertas e fechadas com termos relacionados. Os modelos disponíveis são Bug, Melhoria e o contato para segurança; escolha o mais adequado e preencha os campos obrigatórios.

Uma boa issue contém:

- o problema e o resultado esperado;
- passos de reprodução numerados, com o menor exemplo possível;
- ambiente envolvido (navegador, dispositivo, versão ou commit);
- contexto adicional, sem dados reais nem segredos.

As etiquetas de tipo, área, prioridade e triagem estão descritas na seção [Etiquetas](#etiquetas).

A triagem acontece em até 7 dias. Uma issue pode ser fechada sem correção quando estiver fora do escopo, duplicada ou sem informação; nesse caso o motivo é explicado e a porta fica aberta para uma proposta mais precisa. Se a issue aberta for resolvida por conta própria, comente o desfecho e feche.

Relacione a issue ao pull request com `Closes #123` quando a mudança encerrar o assunto, ou `Refs #123` quando apenas caminhar na direção dele. A ligação com `Closes` só funciona no pull request que aponta para a branch padrão.

### Etiquetas

Toda issue e todo pull request recebe ao menos uma etiqueta de tipo e uma de área. A prioridade é definida na triagem, e a etiqueta `triagem` sai quando o tipo, a área e a prioridade estiverem confirmados. Pull requests do Dependabot recebem `dependencies` automaticamente e dispensam as demais.

| Grupo      | Etiquetas                                                                                     | Uso                                                    |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Tipo       | `bug`, `enhancement`, `documentation`, `refactor`, `testes`, `ci`, `desempenho`, `manutencao` | Natureza da mudança.                                   |
| Área       | `area: web`, `area: api`, `area: banco`, `area: infra`                                        | Parte do sistema afetada.                              |
| Prioridade | `prioridade: alta`, `prioridade: media`, `prioridade: baixa`                                  | Urgência definida na triagem.                          |
| Triagem    | `triagem`                                                                                     | Aguardando confirmação de tipo, área e prioridade.     |

O catálogo fica em [.github/labels.json](../.github/labels.json) e é aplicado com `npm run etiquetas:sync`, que cria ou atualiza as etiquetas pelo GitHub CLI. O workflow `etiquetas.yml` aplica `area:` pelos caminhos alterados e o tipo pelo prefixo do título, e o check `validar` reprova pull requests sem etiqueta obrigatória ou com título fora do padrão Conventional Commits. Pull requests do tipo `docs` dispensam etiqueta de área.

Antes de criar uma etiqueta nova, confirme que ela tem público, dono e regra automatizada no mesmo pull request, seja pelo catálogo, pelo mapeamento de caminhos ou pelo título. Etiqueta sem automação tende a não ser aplicada.

Para aplicar:

```bash
gh issue create --label "bug" --label "area: web"
gh pr create --label "refactor" --label "area: banco"
gh pr edit 123 --add-label "prioridade: alta"
gh pr view 123 --json labels
```

### Branches

Parta da `main` atualizada e use `tipo/descricao-curta`, em minúsculas, com hífens e sem acento, com o tipo alinhado ao commit principal:

- `feat/` para funcionalidades novas.
- `fix/` para correções.
- `hotfix/` para correções urgentes em produção.
- `docs/`, `test/`, `refactor/`, `perf/`, `chore/` e `ci/` para os demais casos.
- `release/` para linhas de manutenção, como `release/1.x`, criadas apenas quando houver uma linha antiga a suportar.

Exemplos presentes no histórico: `feat/seguranca-robustez` e `fix/csp-fontes-botoes-ci`.

Branches criadas por agentes de IA seguem esta mesma convenção de tipo, conforme a [Conventional Branch](https://conventional-branch.github.io/). A autoria assistida fica registrada no rodapé `Assisted-by` do commit e no corpo do pull request.

### Commits

Siga o [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em português, no imperativo e descrevendo o efeito da mudança, com escopo entre parênteses quando ajudar a localizar a área.

```text
<tipo>(<escopo opcional>): <descrição>

[corpo opcional]

[rodapé opcional]
```

Tipos usados:

| Tipo       | Uso                                        |
| ---------- | ------------------------------------------ |
| `feat`     | Funcionalidade nova.                       |
| `fix`      | Correção de comportamento.                 |
| `docs`     | Documentação.                              |
| `test`     | Testes.                                    |
| `refactor` | Mudança interna sem alterar comportamento. |
| `perf`     | Desempenho.                                |
| `chore`    | Manutenção e dependências.                 |
| `ci`       | Workflows e automação.                     |
| `build`    | Build e empacotamento.                     |
| `revert`   | Reversão de commit anterior.               |

Escopos comuns: `web`, `api`, `contratos`, `docs`, `test`, `e2e`, `ci`, `infra`.

Regras:

- Cada commit é atômico: contém uma única mudança lógica, completa e autossuficiente. O código compila e as verificações passam em cada commit.
- Não misture contextos no mesmo commit, como formatação, refatoração e mudança de comportamento. Se o commit cabe em mais de um tipo, divida.
- O histórico exposto não contém trabalho em andamento nem correção de revisão. Durante o desenvolvimento, use `git commit --fixup <commit>` e limpe a branch com `git rebase -i --autosquash` antes de publicar.
- Todos os commits do mesmo assunto ficam em uma única branch e um único pull request.
- Prefira mudanças pequenas e revisáveis, na linha do [Google Engineering Practices](https://google.github.io/eng-practices/review/developer/small-cls.html): cerca de 100 linhas é um tamanho razoável e 1000 é grande demais. Se o assunto não fechar em um pull request único, combine a divisão antes de começar.
- Use o corpo para explicar o porquê quando a descrição não bastar.
- Use rodapé para referências: `Closes #123`, `Refs #123`.
- Mudança incompatível usa `!` depois do tipo ou escopo, ou o rodapé `BREAKING CHANGE:`.
- Commits com geração relevante por ferramenta de IA levam o rodapé `Assisted-by: ferramenta:modelo`. A responsabilidade pela mudança é de quem envia.
- Evite commits de trabalho em andamento na `main`; o histórico da `main` vem de pull requests.

Exemplos:

```text
feat(web): adiciona timeout, retry e tratamento global de 401
fix(api): corrige a política de anexos no RLS
docs: sincroniza a documentação com o estado atual do código
test(e2e): adapta os fluxos migrados para modal
```

### Pull requests

Um pull request resolve um assunto e reúne todos os commits dele. Se a mudança misturar refatoração e comportamento, separe em pull requests menores. Refatorações grandes andam em pull request próprio, sem misturar com correção ou funcionalidade. Se o trabalho virar dois assuntos independentes, combine a divisão e abra pull requests separados.

Abra o pull request somente quando o trabalho estiver finalizado: verificações locais passando, título em Conventional Commits, documentação e CHANGELOG atualizados, etiquetas definidas e revisão do próprio diff feita. Não use `gh pr create --fill`, porque o corpo deve vir do template.

Se o CI falhar ou surgir algo novo depois da abertura, converta o pull request para rascunho com `gh pr ready --undo`, faça os commits atômicos e rode as verificações de novo. Marque como pronto com `gh pr ready` somente com tudo verde. Enquanto o pull request estiver em rascunho, não peça revisão. Depois que a revisão começar, prefira commits novos que respondem ao feedback; se precisar reescrever a história, use `git push --force-with-lease` e explique o motivo na conversa.

A descrição deve conter:

- o problema e o resultado esperado;
- o que mudou e por quê;
- as etiquetas aplicadas;
- como validar: comandos executados e, quando aplicável, capturas ou passos de interface;
- riscos, migrações ou variáveis de ambiente novas;
- a issue relacionada, com `Closes #123` quando aplicável.

Quando a mudança tocar dependências, autenticação, permissões, workflows ou dados sensíveis, descreva o risco e como ele foi tratado.

Antes de abrir, rode as verificações locais:

```bash
npm run type-check
npm run lint
npm run test:texto
npm run test:unit     # integração da API e unidade do web, com o Compose no ar
npm run test:e2e:docker   # Playwright na imagem oficial, com o aplicativo no ar
npm run test:pwa:docker   # PWA na imagem oficial, com o build de produção no ar
```

Preencha o checklist do template de pull request. Ao alterar comportamento, atualize a documentação correspondente e os testes.

### Revisão e integração contínua

Toda mudança passa por revisão e pelos workflows do GitHub Actions:

| Workflow         | Etapas                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `qualidade.yml`  | `npm ci`, `type-check`, `lint` e `build-only` em pull requests e por dispatch manual.                              |
| `etiquetas.yml`  | Aplica etiquetas de área e de tipo e valida o título e as etiquetas em pull requests fora de rascunho.            |
| `testes.yml`     | Sobe o Compose, espera `/api/saude`, valida o runtime da Vercel e roda `npm run test:unit` com PostgreSQL e Redis. |
| `codeql.yml`     | Análise CodeQL de javascript-typescript em push, pull request e agenda semanal.                                    |
| `migracoes.yml`  | Aplica as migrações em produção e a senha do papel em push para `main` com mudanças no schema.                     |
| `publicacao.yml` | Publica a imagem no GHCR ao liberar uma release estável e por dispatch manual.                                     |

A `main` é protegida por rulesets: pull request obrigatório, checks verdes, conversas resolvidas e merge commit como único método. A autoaprovação não existe no GitHub; donos da organização podem mesclar os próprios pull requests com o bypass da regra de revisão, mas continuam sujeitos aos checks de qualidade.

Corrija as falhas antes de pedir nova revisão. Pull requests sem CI verde não são mesclados. O check `validar` volta a rodar quando o título ou as etiquetas mudam; se faltar etiqueta, aplique com `gh pr edit --add-label`. Evite force-push depois que a revisão começar; se precisar reescrever a história, explique o motivo na conversa.

### Estratégia de merge

Mescle por merge commit, preservando os commits da branch e o contexto da revisão. Apague a branch após o merge. Não faça force-push em `main` nem reescreva o histórico já mesclado.

## Padrões de código

- Código e comentários em português, curtos e diretos.
- Domínio em português (`alunos`, `frequencias`, `turmas`); infraestrutura em inglês quando for termo consagrado (`token`, `backup`, nomes de pacotes).
- Cada módulo da API segue `.rotas.ts`, `.servico.ts` e `.repositorio.ts`, com os contratos em `packages/contratos/src`. As exceções são `auth`, `anexos`, `auditoria`, `lgpd` e `tarefas`, que acessam o Prisma no serviço ou na rota.
- Rotas usam validação Zod no limite, `autenticar`, `exigirPapel` e `exigirModulo`, filtro de escopo no serviço e erros no envelope `{ erro: { codigo, mensagem } }`. Recurso fora do escopo responde 404.
- Os contratos são consumidos pela API; o web mantém tipos próprios em `apps/web/src/tipos`, mantidos em sincronia manualmente.
- No web, componentes são arquivos `.vue` em PascalCase, composables usam `useXxx.ts` e serviços e utilitários usam camelCase. Reutilize os componentes existentes e o `reka-ui` antes de criar outro.
- Datas civis trafegam como `yyyy-mm-dd` e timestamps como ISO 8601.
- Segredos apenas por ambiente. Ver [docs/ambiente.md](docs/ambiente.md).
- Sem travessão, meia-risca, reticências tipográficas, aspas curvas, setas ou símbolos decorativos em nenhum arquivo: a guarda editorial em `tests/unit/texto-editorial.test.ts` reprova. Use dois-pontos, vírgula, parênteses, `...` e aspas retas.
- Ao alterar comportamento, atualize a documentação correspondente e os testes.

### Banco e migrações

Crie migrações com `npx prisma migrate dev --name ajuste` em `apps/api`. Nunca edite uma migração aplicada; qualquer ajuste entra como migração nova. O detalhamento de papéis, RLS e retenção está em [docs/banco.md](docs/banco.md).

### Formatação e análise estática

O Prettier e o ESLint cuidam do estilo; o oxlint cobre regras adicionais. Rode `npm run lint` e `npm run format` antes de commitar. Não desative regras sem justificativa no código.

### Comentários no código

- Comente apenas trechos não óbvios, como decisões de segurança, contornos e formatos de interoperabilidade.
- Não comente o óbvio nem repita o nome da função no comentário.

### Contribuições assistidas por IA

Ferramentas de IA são bem-vindas como apoio, mas a responsabilidade pela mudança é de quem envia, e a autoria dos commits é humana. Revise o resultado linha a linha, garanta que ele segue as convenções do repositório, rode as verificações locais e nunca cole segredos, credenciais ou dados reais em ferramentas externas, issues ou commits. Commits com geração relevante levam o rodapé `Assisted-by: ferramenta:modelo`, e o template de pull request tem a seção "Uso de IA". Agentes seguem o [AGENTS.md](AGENTS.md), com as mesmas obrigações de etiquetas, commits atômicos, um único pull request e ciclo de rascunho.

## Testes e qualidade

As suítes combinam integração da API, unidade do frontend, guarda editorial, testes de ponta a ponta e smoke test do banco. Os comandos e pré-requisitos estão em [tests/README.md](tests/README.md); a convenção e a cobertura, em [docs/testes.md](docs/testes.md).

| Suíte                | Requisito                                                                                              | Comando                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Unidade e integração | Compose migrado, Redis, `AUTH_PEPPER`, `DATABASE_URL`, `MIGRATE_DATABASE_URL` e `STORAGE_DRIVER=disco` | `npm run test:unit`                             |
| Guarda editorial     | Nenhum                                                                                                 | `npm run test:texto`                            |
| E2E (Playwright)     | Aplicativo no ar e banco com seed                                                                      | `npm run test:e2e:docker` ou `npm run test:e2e` |
| PWA                  | Build de produção e API em `:3001`                                                                     | `npm run test:pwa:docker` ou `npm run test:pwa` |
| Capturas do README   | Aplicativo no ar e banco com seed                                                                      | `npm run capturas:readme`                       |
| Smoke do banco       | Compose no ar                                                                                          | `npm run test:db`                               |

Regras:

- Os testes de API ficam junto do código, em `apps/api/src/**/*.test.ts`, e usam `construirApp()` com `app.inject`. Os de unidade do frontend ficam em `apps/web/src/**/*.test.ts`.
- Cada arquivo cria e limpa a própria massa com `beforeAll` e `afterAll`, usando emails datados e dados fictícios. Nunca dependa de dados reais.
- Nenhum teste depende de ordem de execução. As suítes rodam em série por compartilharem o banco.
- Ao corrigir um bug, adicione um teste que falharia antes da correção.
- Ao adicionar texto de interface ou documentação, confira que a guarda editorial passa.

O Playwright roda primariamente na imagem oficial da Microsoft, sem instalar navegadores no host, com o aplicativo no ar:

```bash
npm run test:e2e:docker            # todos os projetos
npm run test:e2e:docker:chromium   # apenas o Chromium
npm run test:pwa:docker            # PWA
```

A variável `TEST_BASE_URL` aponta para o aplicativo (padrão `http://localhost:5173` na suíte principal e `http://localhost:4173` no PWA), e `tests/playwright-container.sh` aceita `PLAYWRIGHT_IMAGE`, `PLAYWRIGHT_DOCKER_NETWORK` e `PLAYWRIGHT_DOCKER_USER`. Mantenha a versão da imagem igual à do `@playwright/test` em `package.json`.

A instalação local de navegadores fica como alternativa:

```bash
npm run test:e2e:install
npm run test:e2e
```

As capturas do README são geradas por `tests/e2e/imagens.spec.ts` e gravadas em `docs/imagens/`, com o aplicativo no ar e o seed aplicado. Regenera pelo comando `npm run capturas:readme` (ou `npm run capturas:readme:docker`, na imagem oficial). Os PNGs são versionados e não devem ser editados à mão; mudanças de interface pedem uma nova geração e revisão do diff.

A CI cobre `type-check`, `lint`, `build` e os testes de unidade e integração; ponta a ponta e PWA rodam antes do pull request, como descrito acima.

## Documentação e ADRs

Mudanças estruturais ganham uma nota curta em [docs/adr/](docs/adr/), com estado, contexto, decisão, alternativas e consequências. Novas notas seguem a numeração sequencial e o formato dos ADRs existentes. O índice fica em [docs/README.md](docs/README.md).

### Padrão da documentação

Toda a documentação usa português brasileiro com acentuação e cedilha corretas, em tom técnico e impessoal. Evite primeira pessoa, exclamações e frases de preenchimento.

Restrições de formatação:

- Não use travessão, meia-risca, reticências tipográficas, aspas curvas, setas ou símbolos decorativos. Use dois-pontos, vírgula, parênteses, `...` e aspas retas.
- Evite segunda pessoa explícita e pluralização com parênteses.
- Siga a sintaxe Markdown do GitHub: um único título de nível 1 por arquivo, hierarquia de títulos sem saltos, listas com `-`, cercas de código com linguagem e texto alternativo em imagens.
- Use links relativos para arquivos do repositório e mantenha o texto do link em uma única linha.
- Use alertas (`> [!NOTE]`, `> [!WARNING]`) com parcimônia, no máximo um ou dois por documento.

### Padrão da interface

Os tokens visuais ficam em `apps/web/src/assets/cores.css`, sobre a base do Bootstrap 5.3. A tipografia usa Noto Sans no corpo, Noto Sans Display em títulos e números de destaque e Noto Sans Mono em código, todas via `@fontsource-variable`. Detalhes do design system em [docs/interface.md](docs/interface.md).

## Releases e changelog

As mudanças relevantes são registradas em [CHANGELOG.md](CHANGELOG.md), no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versionamento semântico. Mova as entradas da seção Não publicado para a versão correspondente ao publicar.

Enquanto a primeira versão pública não é lançada, a versão do projeto permanece fixada em `0.1.0` e as mudanças ficam na seção Não publicado. A primeira release será a `v1.0.0`; a partir dela, o versionamento semântico passa a reger as versões.

O fluxo de releases e a política de suporte estão em [docs/releases.md](docs/releases.md).

Crie releases pelo GitHub CLI:

```bash
gh release create vX.Y.Z --generate-notes
```

O workflow `publicacao.yml` publica a imagem no GHCR quando um release estável é publicado.

A implantação na Vercel está pausada; consulte [docs/portabilidade.md](docs/portabilidade.md) para reativar.

## Suporte e dúvidas

Use as issues para dúvidas, sugestões e problemas. A triagem acontece em até 7 dias. Para vulnerabilidades, siga [SECURITY.md](SECURITY.md); para conduta, o [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
