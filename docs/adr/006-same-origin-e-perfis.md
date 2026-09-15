# ADR-006: mesma origem e perfis de implantação

- Estado: aceita.
- Data: 2026.

## Contexto

O cookie de sessão é `HttpOnly` e deve ser first-party. A SPA e a API são pacotes separados no monorepo, e a operação precisa funcionar tanto em Docker quanto em plataformas serverless.

## Decisão

Manter a API servindo o build da SPA como topologia padrão, com `VITE_API_URL` e CORS com credenciais quando o frontend estiver em outro host. Adicionar o perfil full-stack na Vercel com Services (`web` e `api` no mesmo projeto e domínio), preservando Docker, Compose e a imagem no GHCR.

## Alternativas consideradas

- SPA e API sempre separadas: descartada pelo risco de cookie third-party e pela complexidade de CORS.
- Reescrever o frontend em Next.js: descartada pelo custo e por não ser requisito.
- Dois projetos na Vercel: descartada pela necessidade de CORS e cookie cross-site.

## Consequências

- O cookie permanece first-party em todos os perfis.
- Duas topologias de implantação são mantidas e documentadas.
- Services está em beta na Vercel, e o perfil serverless tem limites de 4,5 MB e de duração de função.
- O modo SPA separada continua disponível para quem já opera nesse formato.

Referências: [deploy.md](../deploy.md), [arquitetura.md](../arquitetura.md) e [ambiente.md](../ambiente.md).
