# ADR-003: isolamento por papel com RLS de barreira

- Estado: aceita.
- Data: 2026.

## Contexto

Os dados escolares são sensíveis e o sistema é multiusuário. Uma única camada de filtro é frágil: um `where` esquecido pode expor dados de outra turma, escola ou responsável.

## Decisão

Aplicar duas camadas independentes:

1. Filtro explícito de papel, módulo e escopo nos serviços da API, com leituras fora do escopo respondendo `404`.
2. Políticas RLS no banco, com o papel restrito `buscapp_api` e `app.usuario_id` definido por transação, replicando as regras de visibilidade.

## Alternativas consideradas

- Apenas filtro na API: descartada pela ausência de barreira contra erros de código.
- Apenas RLS: descartada porque as rotinas administrativas e de autenticação usam o dono do schema e não passam pelas políticas.
- Runtime com o dono do schema: descartada por remover a segunda camada.

## Consequências

- Duas camadas independentes de proteção, com o RLS como backstop.
- A API executa uma transação curta por operação para definir o contexto, o que funciona no pooler de transação.
- As regras de escopo são duplicadas em SQL, exigindo manutenção cuidadosa das funções e políticas.
- A conexão administrativa é necessária para autenticação, códigos e migrações.

Referências: [banco.md](../banco.md), [seguranca.md](../seguranca.md) e [arquitetura.md](../arquitetura.md).
