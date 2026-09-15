# Contribuindo

## Rotina

```bash
npm install
cp .env.example .env  # preencha AUTH_PEPPER
npm run compose:up
npm run seed -w @buscapp/api
npm run dev:web       # SPA em http://localhost:5173
npm run dev:api       # API em http://localhost:3001
```

Verificações antes de abrir um pull request:

```bash
npm run type-check
npm run lint
npm run test          # type-check, lint, build da SPA e testes de integração
npm run test:e2e      # com o Compose no ar e o banco com seed
```

## Convenções de código

- Código e comentários em português, curtos e diretos.
- Domínio em português (`alunos`, `frequencias`, `turmas`); infraestrutura em inglês quando for termo consagrado (`token`, `backup`, nomes de pacotes).
- Cada módulo da API segue `.rotas.ts`, `.servico.ts` e `.repositorio.ts`, com os contratos em `packages/contratos/src`.
- Rotas usam validação Zod no limite, `autenticar`, `exigirPapel` e `exigirModulo`, filtro de escopo no serviço e erros no envelope `{ erro: { codigo, mensagem } }`.
- Datas civis trafegam como `yyyy-mm-dd` e timestamps como ISO 8601.
- Migrações: crie com `npx prisma migrate dev --name ajuste` em `apps/api`. Nunca edite uma migração aplicada.
- Segredos apenas por ambiente. Ver [docs/ambiente.md](docs/ambiente.md).
- Cada workspace declara no próprio `package.json` as ferramentas de build que seus scripts usam, para que o install filtrado por serviço funcione sem depender do hoisting do root.
- Ao alterar comportamento, atualize a documentação correspondente e os testes.

## Comentários no código

- Comente apenas trechos não óbvios, como decisões de segurança, contornos e formatos de interoperabilidade.
- Não comente o óbvio nem repita o nome da função no comentário.

## Padrão da documentação

Toda a documentação usa português brasileiro com acentuação e cedilha corretas, em tom técnico e impessoal. Evite primeira pessoa, exclamações e frases de preenchimento.

Restrições de formatação:

- Não use travessão, meia-risca, reticências tipográficas, aspas curvas, setas ou símbolos decorativos. Use dois-pontos, vírgula, parênteses, `...` e aspas retas.
- Siga a sintaxe Markdown do GitHub: um único título de nível 1 por arquivo, hierarquia de títulos sem saltos, listas com `-`, cercas de código com linguagem e texto alternativo em imagens.
- Use links relativos para arquivos do repositório e mantenha o texto do link em uma única linha.
- Use alertas (`> [!NOTE]`, `> [!WARNING]`) com parcimônia, no máximo um ou dois por documento.

## Decisões de arquitetura

Mudanças estruturais ganham uma nota curta em [docs/adr/](docs/adr/), com estado, contexto, decisão, alternativas e consequências. Novas notas seguem a numeração sequencial e o formato dos ADRs existentes. O índice fica em [docs/README.md](docs/README.md).

## Testes

Siga [tests/README.md](tests/README.md) e [docs/testes.md](docs/testes.md). Crie os próprios dados e limpe ao final, sem depender de dados reais.
