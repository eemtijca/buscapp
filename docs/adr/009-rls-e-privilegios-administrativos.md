# ADR-009: RLS e privilégios de coluna nas tabelas administrativas

- Estado: aceita.
- Data: 2026.

## Contexto

O ADR-003 deixou `perfis`, `auditoria`, `codigos_redefinicao`, `codigos_redefinicao_tentativas` e `configuracoes_sistema` fora da RLS porque os fluxos de autenticação usavam o papel de runtime em contexto anônimo. Isso mantinha `senha_hash` legível pelo papel `buscapp_api`.

## Decisão

1. Mover o fluxo de autenticação (login, rehash, último acesso) e a auditoria para o cliente administrativo.
2. Usar `select` explícito em todas as consultas a `perfis`, sem `senha_hash` e `senha_alterada_em`.
3. Revogar o `SELECT` de tabela em `perfis` e reconceder coluna a coluna, sem as colunas sensíveis.
4. Habilitar RLS em `perfis`, `configuracoes_sistema`, `auditoria` e `codigos_redefinicao`, com leitura para autenticados (quando aplicável) e escrita para a gestão; manter `sessoes` e `codigos_redefinicao_tentativas` restritas ao cliente administrativo.

## Alternativas consideradas

- Manter como estava: descartada por deixar o hash de senha exposto à barreira de runtime.
- Somente privilégio de coluna, sem RLS: descartada por não cobrir leitura indevida de outras colunas.
- `omit` global no Prisma Client: descartada por exigir clientes separados e esconder o problema no cliente em vez do banco.

## Consequências

- O papel de runtime não lê `senha_hash` e passa a depender de contexto de sessão nas tabelas cobertas.
- A ordem de implantação importa: o código novo precisa estar no ar antes da migração de RLS.
- Novas consultas a `perfis` precisam de `select` explícito.

Referências: [banco.md](../banco.md), [seguranca.md](../seguranca.md) e [ADR-003](003-rls-backstop.md).
