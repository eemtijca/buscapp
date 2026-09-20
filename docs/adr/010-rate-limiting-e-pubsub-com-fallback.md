# ADR-010: rate limiting no Postgres e pub/sub com fallback

- Estado: aceita.
- Data: 2026.

## Contexto

As rotas de autenticação não tinham limitação de tentativas por IP, e o barramento SSE em memória não cruza instâncias na Vercel. O plano gratuito do Upstash tem cota mensal de comandos, e um limitador global multiplicaria o consumo pelo polling de notificações.

## Decisão

1. Rate limiting com `@fastify/rate-limit` e um store próprio sobre a tabela `rate_limit_contadores`, com upsert atômico em uma ida ao banco e leitura sem incremento para contar apenas falhas de login.
2. Limites somente nas rotas sensíveis (login, solicitar código, redefinir senha e uploads de anexo).
3. Redis (ioredis) dedicado ao pub/sub do SSE, com uma conexão de assinatura por instância.
4. Fallback de publicação e escuta por `pg_notify` e `LISTEN` reutilizando `MIGRATE_DATABASE_URL`, que já é a conexão de sessão.

## Alternativas consideradas

- Rate limiting em memória: descartada por não valer entre instâncias.
- Redis como store principal: descartada pelo risco de cota e por não ser necessária na escala atual.
- `LISTEN/NOTIFY` como caminho principal: descartada por exigir conexão de sessão permanente.

## Consequências

- O rate limiting funciona sem dependência externa e com estado compartilhado.
- O Redis fica com volume baixo, compatível com o plano gratuito.
- O fallback depende da conexão de sessão do banco; a indisponibilidade do store de rate limiting é fail-open com alerta.

Referências: [seguranca.md](../seguranca.md), [ambiente.md](../ambiente.md) e [ADR-005](005-tempo-real-sse.md).
