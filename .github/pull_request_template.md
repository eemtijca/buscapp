## Descrição

Descreva o problema, a solução e o motivo da mudança.

## Issue relacionada

Closes #

## Tipo de mudança

- [ ] Correção de bug
- [ ] Funcionalidade nova
- [ ] Refatoração ou manutenção
- [ ] Documentação
- [ ] Testes ou CI

## Etiquetas

Aplique ao menos uma etiqueta de tipo e uma de área com `gh pr edit --add-label`. Pull requests do Dependabot recebem `dependencies` e dispensam as demais.

- Tipo: `bug`, `enhancement`, `documentation`, `refactor`, `testes`, `ci`, `desempenho` ou `manutencao`
- Área: `area: web`, `area: api`, `area: banco` ou `area: infra`

## Commits

- [ ] Cada commit é uma mudança lógica completa e revisável, sem trabalho em andamento.
- [ ] O histórico exposto passou por `git rebase -i --autosquash` e está limpo.
- [ ] Todos os commits do assunto estão neste único pull request.
- [ ] O título segue Conventional Commits, no formato `tipo(escopo): descrição`.

## Como validar

Informe os comandos executados e, quando aplicável, os passos de interface. Inclua capturas de antes e depois em mudanças visuais.

## Riscos e migrações

Descreva riscos, migrações de banco, variáveis de ambiente novas e mudanças incompatíveis. Use "Não se aplica" quando não houver.

## Impacto de versão

Aplique a etiqueta `versao:` correspondente ao impacto: `versao: maior` para mudança incompatível, `versao: menor` para funcionalidade nova compatível e `versao: correcao` para correção compatível. A partir da v1.0.0, o changelog é gerado a partir dos commits convencionais, então o título do pull request é a fonte da entrada.

## Uso de IA

Informe se houve apoio de ferramentas de IA e como o resultado foi revisado. A responsabilidade pela mudança é de quem envia. Commits com geração relevante levam o rodapé `Assisted-by: ferramenta:modelo`.

## Checklist

- [ ] Abri o pull request somente com o trabalho finalizado.
- [ ] Se precisei mexer depois da abertura, converti para rascunho com `gh pr ready --undo` e só marquei como pronto com tudo verde.
- [ ] Segui o padrão de branches e commits do [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] Revisei o próprio diff antes de pedir revisão.
- [ ] Rodei `npm run type-check`, `npm run lint` e `npm run test:texto`.
- [ ] Rodei `npm run test:unit` com o Compose migrado.
- [ ] Rodei `npm run test:e2e:docker` e `npm run test:pwa:docker` quando a mudança afeta a interface.
- [ ] Atualizei a documentação correspondente e o CHANGELOG.md.
- [ ] Revisei a segurança quando a mudança toca dependências, autenticação, permissões, workflows ou dados sensíveis.
- [ ] Não incluí segredos nem dados reais de alunos, responsáveis ou professores.
