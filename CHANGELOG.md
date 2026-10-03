# Changelog

Todas as mudanças relevantes deste projeto são registradas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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

### Modificado

- Guia de contribuição e AGENTS.md passam a exigir etiquetas em issues e pull requests, commits atômicos organizados em um único pull request e abertura somente com o trabalho finalizado.
- Textos de interface, mensagens e documentação ajustados à convenção editorial, com pluralização correta e sem segunda pessoa.
- Nomes exibidos dos workflows alinhados ao padrão em português.
- Referências da arquitetura e dos testes atualizadas.
