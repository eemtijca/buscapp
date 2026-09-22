# Contribuindo

Guia de desenvolvimento do BuscApp: como preparar o ambiente, propor mudanças, escrever código, testar e documentar. Dúvidas e propostas podem ser abertas como issue; o detalhamento técnico está em [docs/](docs/README.md). Para vulnerabilidades, siga [SECURITY.md](SECURITY.md) e nunca abra issue pública com dados sensíveis.

## Ambiente de desenvolvimento

Pré-requisitos: Node 20.19 ou superior, ou 22.12 ou superior, e Docker com Compose. Também é possível usar um PostgreSQL 15 ou superior próprio, conforme [docs/ambiente.md](docs/ambiente.md).

```bash
npm install
cp .env.example .env  # preencha AUTH_PEPPER com pelo menos 32 caracteres
npm run compose:up
npm run seed -w @buscapp/api
npm run dev:web       # SPA em http://localhost:5173
npm run dev:api       # API em http://localhost:3001
```

O Compose sobe a aplicação em `http://localhost:3000` com o PostgreSQL em `localhost:5433`. As credenciais de desenvolvimento estão em [docs/ambiente.md](docs/ambiente.md). Comandos úteis na raiz:

| Comando                          | Efeito                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run compose:up`             | Sobe a aplicação e o banco via Docker Compose.             |
| `npm run compose:down`           | Derruba o ambiente.                                        |
| `npm run dev:web` / `npm run dev:api` | Servidores de desenvolvimento isolados.               |
| `npm run db:generate`            | Regenera o cliente Prisma.                                 |
| `npm run db:migrate`             | Aplica as migrações pendentes.                             |
| `npm run format`                 | Roda o Prettier nos diretórios de código.                  |

Cada workspace declara no próprio `package.json` as ferramentas de build que seus scripts usam, para que o install filtrado por serviço funcione sem depender do hoisting do root.

## Fluxo de contribuição e pull requests

### Issues e discussão

Descreva o problema ou a proposta antes de codificar quando a mudança for estrutural. Para bugs, inclua passos de reprodução, comportamento observado, comportamento esperado e o commit afetado. Evite anexar dados reais de alunos, responsáveis ou professores.

### Branches

Parta da `main` atualizada e use o padrão `tipo/descricao-curta`, com o tipo alinhado ao commit principal:

- `feat/` para funcionalidades novas.
- `fix/` para correções.
- `docs/`, `test/`, `refactor/`, `perf/`, `chore/` e `ci/` para os demais casos.

Exemplos presentes no histórico: `feat/seguranca-robustez`, `fix/csp-fontes-botoes-ci`.

### Commits

Siga o padrão Conventional Commits, em português, no imperativo e descrevendo o efeito da mudança. Use escopo entre parênteses quando ajudar a localizar a área:

- Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `build`.
- Escopos comuns: `web`, `api`, `contratos`, `docs`, `test`, `e2e`, `ci`, `infra`.

```text
feat(web): adiciona timeout, retry e tratamento global de 401
fix(api): corrige CSP das fontes e o tamanho dos botões no mobile
docs: sincroniza a documentação com o estado atual do código
test(e2e): adapta os fluxos migrados para modal
```

Mantenha cada commit coerente e evitável de reverter de forma isolada. Evite commits de trabalho em andamento na `main`; o histórico da `main` vem de pull requests.

### Pull requests

Um pull request resolve um assunto. Se a mudança misturar refatoração e comportamento, separe em pull requests menores.

A descrição deve conter:

- O problema e o resultado esperado.
- O que mudou e por quê.
- Como validar: comandos executados e, quando aplicável, capturas ou passos de interface.
- Riscos, migrações ou variáveis de ambiente novas.
- A issue relacionada, quando houver.

Antes de abrir, rode as verificações locais:

```bash
npm run type-check
npm run lint
npm run test          # type-check, lint, build da SPA e testes de unidade
npm run test:e2e      # com o Compose no ar e o banco com seed
```

Preencha o checklist do template de pull request. Ao alterar comportamento, atualize a documentação correspondente e os testes.

### Revisão e integração contínua

Toda mudança passa por revisão e pelos workflows do GitHub Actions:

| Workflow         | Etapas                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `qualidade.yml`  | `npm ci`, `type-check`, `lint` e `build-only` em pull requests.                                     |
| `testes.yml`     | Sobe o Compose, espera `/api/saude` e roda `npm run test:unit` com PostgreSQL e Redis.              |
| `codeql.yml`     | Análise CodeQL de javascript-typescript em push, pull request e agenda semanal.                     |
| `migracoes.yml`  | Aplica as migrações em produção em push para `main` com mudanças no schema.                         |
| `publicacao.yml` | Publica a imagem no GHCR ao liberar uma release estável.                                            |

Corrija as falhas antes de pedir nova revisão. Pull requests sem CI verde não são mesclados.

### Estratégia de merge

Mescle por merge commit, preservando os commits da branch e o contexto da revisão. Apague a branch após o merge. Não faça force-push em `main` nem reescreva o histórico já mesclado.

## Padrões de código

- Código e comentários em português, curtos e diretos.
- Domínio em português (`alunos`, `frequencias`, `turmas`); infraestrutura em inglês quando for termo consagrado (`token`, `backup`, nomes de pacotes).
- Cada módulo da API segue `.rotas.ts`, `.servico.ts` e `.repositorio.ts`, com os contratos em `packages/contratos/src`.
- Rotas usam validação Zod no limite, `autenticar`, `exigirPapel` e `exigirModulo`, filtro de escopo no serviço e erros no envelope `{ erro: { codigo, mensagem } }`.
- Datas civis trafegam como `yyyy-mm-dd` e timestamps como ISO 8601.
- Segredos apenas por ambiente. Ver [docs/ambiente.md](docs/ambiente.md).
- Ao alterar comportamento, atualize a documentação correspondente e os testes.

### Banco e migrações

Crie migrações com `npx prisma migrate dev --name ajuste` em `apps/api`. Nunca edite uma migração aplicada; qualquer ajuste entra como migração nova. O detalhamento de papéis, RLS e retenção está em [docs/banco.md](docs/banco.md).

### Formatação e análise estática

O Prettier e o ESLint cuidam do estilo; o oxlint cobre regras adicionais. Rode `npm run lint` e `npm run format` antes de commitar. Não desative regras sem justificativa no código.

### Comentários no código

- Comente apenas trechos não óbvios, como decisões de segurança, contornos e formatos de interoperabilidade.
- Não comente o óbvio nem repita o nome da função no comentário.

## Testes e qualidade

As suítes combinam integração da API, unidade do frontend, testes de ponta a ponta e smoke test do banco. Os comandos e pré-requisitos estão em [tests/README.md](tests/README.md); a convenção e a cobertura, em [docs/testes.md](docs/testes.md).

| Suíte             | Requisito                          | Comando             |
| ----------------- | ---------------------------------- | ------------------- |
| Unidade e integração | Banco do Compose migrado        | `npm run test:unit` |
| E2E (Playwright)  | API e SPA no ar, banco com seed    | `npm run test:e2e`  |
| PWA               | Build de produção e API em `:3001` | `npm run test:pwa`  |
| Smoke do banco    | Compose no ar                      | `npm run test:db`   |

Regras:

- Os testes de API ficam junto do código, em `apps/api/src/**/*.test.ts`, e usam `construirApp()` com `app.inject`. Os de unidade do frontend ficam em `apps/web/src/**/*.test.ts`.
- Cada arquivo cria e limpa a própria massa com `beforeAll` e `afterAll`, usando emails datados e dados fictícios. Nunca dependa de dados reais.
- Nenhum teste depende de ordem de execução. As suítes rodam em série por compartilharem o banco.
- Ao corrigir um bug, adicione um teste que falharia antes da correção.

Playwright e o teste de PWA continuam de execução local: rode os dois antes de abrir o pull request. A CI cobre `type-check`, `lint`, `build` e os testes de unidade e integração.

## Documentação e ADRs

Mudanças estruturais ganham uma nota curta em [docs/adr/](docs/adr/), com estado, contexto, decisão, alternativas e consequências. Novas notas seguem a numeração sequencial e o formato dos ADRs existentes. O índice fica em [docs/README.md](docs/README.md).

### Padrão da documentação

Toda a documentação usa português brasileiro com acentuação e cedilha corretas, em tom técnico e impessoal. Evite primeira pessoa, exclamações e frases de preenchimento.

Restrições de formatação:

- Não use travessão, meia-risca, reticências tipográficas, aspas curvas, setas ou símbolos decorativos. Use dois-pontos, vírgula, parênteses, `...` e aspas retas.
- Siga a sintaxe Markdown do GitHub: um único título de nível 1 por arquivo, hierarquia de títulos sem saltos, listas com `-`, cercas de código com linguagem e texto alternativo em imagens.
- Use links relativos para arquivos do repositório e mantenha o texto do link em uma única linha.
- Use alertas (`> [!NOTE]`, `> [!WARNING]`) com parcimônia, no máximo um ou dois por documento.

### Padrão da interface

Os tokens visuais ficam em `apps/web/src/assets/cores.css`, sobre a base do Bootstrap 5.3. A tipografia usa Noto Sans no corpo, Noto Sans Display em títulos e números de destaque e Noto Sans Mono em código, todas via `@fontsource-variable`. Detalhes do design system em [docs/interface.md](docs/interface.md).
