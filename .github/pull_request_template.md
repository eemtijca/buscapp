## Descrição

Descreva o problema e o resultado esperado, o que mudou e por quê.

## Issue relacionada

Closes #

## Como validar

Informe os comandos executados e, quando aplicável, os passos de interface. Inclua capturas de antes e depois em mudanças visuais.

## Tipo de mudança

- [ ] Correção de bug
- [ ] Funcionalidade nova
- [ ] Refatoração ou manutenção
- [ ] Documentação
- [ ] Testes ou CI

## Riscos e migrações

Descreva riscos, migrações de banco e variáveis de ambiente novas. Use "Não se aplica" quando não houver.

## Checklist

- [ ] Segui o padrão de branches e commits do [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] Revisei o próprio diff antes de pedir revisão.
- [ ] Rodei `npm run type-check`, `npm run lint` e `npm run test:texto`.
- [ ] Rodei `npm run test:unit` com o Compose migrado.
- [ ] Rodei `npm run test:e2e:docker` e `npm run test:pwa:docker` quando a mudança afeta a interface.
- [ ] Atualizei a documentação correspondente e o CHANGELOG.md.
- [ ] Revisei a segurança quando a mudança toca dependências, autenticação, permissões, workflows ou dados sensíveis.
- [ ] Não incluí segredos nem dados reais de alunos, responsáveis ou professores.
