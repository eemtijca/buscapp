# ADR-011: fuso horário da escola no servidor

- Estado: aceita.
- Data: 2026.

## Contexto

O horário protegido do chat era calculado com `getDay()` e `getHours()` do processo. Em container e na Vercel o processo roda em UTC, então a janela de 07:00 às 17:00 valia das 04:00 às 14:00 em Brasília, e o cliente (fuso do navegador) discordava do servidor.

## Decisão

1. Adicionar `TZ_ESCOLA` validada com `Intl` (padrão `America/Sao_Paulo`).
2. Calcular o dia da semana e os minutos do dia com `Intl.DateTimeFormat` no fuso configurado, tanto na API quanto no frontend.
3. Expor o fuso efetivo em `GET /api/configuracoes` para o cliente decidir igual ao servidor.
4. Corrigir as datas civis do frontend para usar o fuso local (`hojeIso` e `isoLocal`), e não `toISOString`.

## Alternativas consideradas

- Depender da variável `TZ` do sistema: descartada por não ser explícita no código e por variar entre ambientes.
- Converter apenas no navegador: descartada porque a regra precisa valer no servidor.
- Manter UTC: descartada por inverter o horário escolar.

## Consequências

- A janela do chat passa a valer no fuso da escola em qualquer ambiente.
- A validação de janela também deixou de misturar o início do primeiro dia com o fim do último.
- Testes cobrem decisões iguais com `TZ=UTC` e `TZ=America/Sao_Paulo`.

Referências: [ambiente.md](../ambiente.md), [modulos.md](../modulos.md) e [interface.md](../interface.md).
