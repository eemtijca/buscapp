# ADR-001: Prisma 7 com driver adapter pg

- Estado: aceita.
- Data: 2026.

## Contexto

A migração para stack própria exigia um ORM que versionasse SQL complexo (RLS, triggers e CHECKs) e funcionasse bem em serverless. O Prisma 8 ainda estava em RC, e a versão 6 poderia arrastar binários Rust e aumentar o pacote das funções.

## Decisão

Adotar Prisma 7.10 com o generator `prisma-client`, saída em `apps/api/generated/prisma` e o driver adapter `@prisma/adapter-pg`. O pool `pg` fica explícito em `apps/api/src/nucleo/banco/cliente.ts`, com tamanho configurável por `DB_POOL_MAX` e liberação de conexões ociosas via `attachDatabasePool` quando a aplicação roda na Vercel.

## Alternativas consideradas

- Prisma 8 RC: descartada por instabilidade em produção.
- Prisma 6 com binário Rust: descartada pelo tamanho e pela complexidade de empacotamento em serverless.
- Outro ORM ou SQL puro: descartada pela perda de tipagem e de migrações versionadas.

## Consequências

- O cliente é gerado sem binário Rust, com o query compiler em JavaScript.
- O pool de conexões é responsabilidade da aplicação, o que exige `DB_POOL_MAX` adequado em serverless.
- O build sempre roda `prisma generate` antes de compilar a API.
- As migrações continuam em SQL versionado, preservando RLS, triggers e CHECKs.

Referências: [banco.md](../banco.md), [ambiente.md](../ambiente.md) e [arquitetura.md](../arquitetura.md).
