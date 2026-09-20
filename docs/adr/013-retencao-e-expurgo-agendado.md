# ADR-013: retenção e expurgo agendado

- Estado: aceita.
- Data: 2026.

## Contexto

`dias_expurgo_anexos` e `dias_retencao_codigos` existiam como parâmetros declarativos, sem rotina que os aplicasse. Sessões encerradas e contadores de rate limiting também cresciam sem limpeza. O servidor não tem `pg_cron` no Compose.

## Decisão

1. Expor `POST /api/tarefas/expurgo`, autenticado por `CRON_SECRET` (Bearer), idempotente, que remove anexos vencidos (objeto no storage e registro), códigos fora da janela, sessões encerradas antigas e contadores de rate limiting expirados.
2. Agendar por Vercel Cron ou GitHub Actions, sem depender de cron no banco.
3. Registrar a execução na auditoria e alertar em caso de falha.
4. Aplicar `dias_expurgo_anexos` no momento da criação do anexo, em vez de usar apenas o padrão da coluna.

## Alternativas consideradas

- `pg_cron` no Supabase: descartada por não remover objetos do Storage e por não existir no Compose.
- Expurgo sob demanda manual: descartada por depender de operação humana recorrente.
- Exclusão física imediata ao expirar: descartada por não dar janela de auditoria.

## Consequências

- A retenção deixa de ser declarativa e passa a ter execução rastreável.
- O endpoint precisa de segredo configurado; sem ele, responde 404.
- A remoção de objetos do storage é best-effort: falhas deixam órfãos para a próxima execução.

Referências: [banco.md](../banco.md), [operacao.md](../operacao.md) e [deploy.md](../deploy.md).
