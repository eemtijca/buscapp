# ADR-012: cabeçalhos de segurança e verificação de origem

- Estado: aceita.
- Data: 2026.

## Contexto

A aplicação dependia apenas de `SameSite=Lax` e CORS restrito, sem cabeçalhos de segurança nem política de conteúdo. O download de anexos servia conteúdo enviado por usuário na mesma origem, sem `nosniff` nem sandbox.

## Decisão

1. Registrar `@fastify/helmet` com CSP própria: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `object-src 'none'`, `frame-ancestors 'none'` e `upgrade-insecure-requests` apenas em produção.
2. Adicionar `headers` no topo do `vercel.json` para a SPA servida pelo serviço `web`, com a mesma política, `nosniff`, `Referrer-Policy`, `X-Frame-Options` e HSTS.
3. Verificar `Origin` em métodos mutantes sob `/api`, rejeitando origens fora de `APP_URL` e `APP_ORIGINS` com 403.
4. No download de anexos, usar `Content-Disposition: attachment` para tipos não exibíveis, `Content-Security-Policy: sandbox` e `nosniff`.

## Alternativas consideradas

- Token CSRF explícito: descartado por duplicar a proteção de origem sem ganho no perfil de mesma origem.
- CSP com nonce: descartada por exigir mudanças no build da SPA; `style-src 'unsafe-inline'` cobre o Bootstrap.
- Sem CSP: descartada por deixar a superfície de XSS sem segunda barreira.

## Consequências

- A SPA e a API respondem com cabeçalhos de segurança; a verificação de origem vira defesa em profundidade.
- Estilos inline continuam permitidos; scripts inline não.
- O perfil de SPA separada precisa repetir os cabeçalhos no host do frontend.

Referências: [seguranca.md](../seguranca.md), [deploy.md](../deploy.md) e [ADR-006](006-same-origin-e-perfis.md).
