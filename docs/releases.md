# Releases

Este documento descreve a política de versões e o fluxo de release do BuscApp.

## Política de versão

O projeto segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/) e mantém o [CHANGELOG.md](../CHANGELOG.md) no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

- Versão maior: mudança incompatível em rotas, contratos da API, formato do backup ou configuração obrigatória.
- Versão menor: funcionalidade nova compatível com as versões anteriores.
- Versão de correção: correção de comportamento, segurança e dependências.

Enquanto a primeira versão pública não é lançada, a versão permanece fixada em `0.1.0` e as mudanças acumulam na seção Não publicado do changelog. O deploy continua acompanhando a `main`.

## Fluxo a partir da v1.0.0

A primeira release será a `v1.0.0`. A partir dela:

1. o [release-please](https://github.com/googleapis/release-please) mantém um pull request de release com a versão e o changelog;
2. o merge do pull request de release cria a tag `vX.Y.Z` e a release imutável no GitHub;
3. o workflow de implantação roda no ambiente `release`: valida a versão, aplica migrações, publica a imagem no GHCR e faz o deploy na Vercel;
4. o deploy de produção acontece somente por tag; os previews continuam por pull request.

## Etiquetas de versão

- `versao: maior`, `versao: menor` e `versao: correcao` são aplicadas pelo workflow de etiquetas conforme o título do pull request.
- O rodapé `Assisted-by` registra a autoria assistida por IA.

## Retroporte e suporte

- Correções entram primeiro na `main` e saem na próxima versão de correção.
- Quando existir uma linha antiga a manter, a branch `release/1.x` nasce da tag correspondente e recebe retroportes com a etiqueta `backport release/1.x`.
- A linha anterior recebe apenas segurança e correções críticas por 3 meses após o lançamento do próximo major.

## Backup e rollback

- Antes de aplicar migrações no release, confirme um backup recente do banco e registre no checklist.
- Para reverter o aplicativo, promova o deployment anterior no provedor.
- Para reverter dados, crie uma migração corretiva; uma migração aplicada nunca é editada.
