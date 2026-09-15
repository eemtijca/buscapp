# ADR-007: sonda de sessão sem 401 em GET /api/auth/me

- Estado: aceita.
- Data: 2026.

## Contexto

A SPA precisa saber, no boot e a cada navegação, se existe sessão antes de decidir a rota. O cookie `buscapp_sessao` é `HttpOnly`, então o frontend não consegue ler o estado sem consultar a API. A rota `GET /api/auth/me` usava o preHandler `autenticar` e respondia `401` com `{ erro: { codigo: 'nao_autenticado' } }` para anônimos, o que gerava ruído de console e de rede na tela de login, sem distinguir "sem sessão" de uma falha real. Como a raiz `/` é a própria tela de login, evitar a chamada nas rotas públicas também removeria o auto-redirect de quem já tem sessão válida.

## Decisão

Transformar `GET /api/auth/me` em uma sonda que não falha:

1. A rota deixa de usar `autenticar` e resolve a sessão com `autenticarOpcional`, que devolve `null` quando não há cookie válido em vez de lançar `401`.
2. A resposta é `200` com `{ perfil: perfilAutenticadoSchema.nullable() }`: o perfil quando a sessão é válida, ou `null` quando não há cookie, a sessão expirou ou foi revogada.
3. Quando há perfil, o contexto de RLS (`app.usuario_id`) continua sendo definido.
4. As demais rotas privadas seguem com `autenticar` e o envelope `{ erro: { codigo, mensagem } }` com status `401` para sessão ausente.

## Alternativas consideradas

- Manter o `401` e não sondar rotas públicas: descartada porque impede o auto-redirect de sessões válidas em carregamento novo de `/`.
- Endpoint dedicado `GET /api/auth/sessao`: descartada por duplicar a leitura do perfil sem ganho.
- Cookie de dica não-`HttpOnly` (ex.: `buscapp_sessao_ativa=1`): descartada porque adiciona estado que pode ficar obsoleto em relação à sessão real.

## Consequências

- Usuários anônimos deixam de receber `401` na tela de login e o auto-redirect é preservado.
- A rota é uma exceção documentada ao padrão de erro da API, registrada em [api.md](../api.md).
- Os testes de autenticação e de usuários passam a esperar `200` com `perfil: null` para sessões ausentes ou revogadas.
- A verificação de status da conta passa a rodar apenas no shell autenticado, e não nas telas públicas.

Referências: [api.md](../api.md), [interface.md](../interface.md) e [ADR-002](002-autenticacao-propria.md).
