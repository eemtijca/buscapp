# ADR-002: autenticação própria com sessão opaca e códigos HMAC

- Estado: aceita.
- Data: 2026.

## Contexto

O projeto usava o Supabase Auth e passou a operar sem dependência de fornecedor. Era necessário manter o controle de revogação imediata, verificar os hashes bcrypt legados e permitir primeiro acesso sem envio de e-mail.

## Decisão

Implementar autenticação própria:

1. Senhas com scrypt e verificação de hashes bcrypt legados, regravados no login.
2. Sessão opaca com 32 bytes aleatórios apenas no cookie `HttpOnly`, validade de 12 horas ou 30 dias e SHA-256 no banco.
3. Códigos de 6 dígitos gerados pela gestão, guardados como HMAC-SHA256 com `AUTH_PEPPER`, com expiração, revogação e bloqueio por tentativas.

## Alternativas consideradas

- JWT de acesso com refresh opaco: descartada pela complexidade de rotação sem ganho para o caso.
- Manter o Supabase Auth: descartada pela dependência de fornecedor.
- Primeiro acesso por e-mail: descartada porque o público pode não ter e-mail institucional ativo.

## Consequências

- Revogação imediata em logout, inativação e redefinição de senha.
- O banco guarda apenas hash de sessão e HMAC de código, nunca o valor utilizável.
- Não há rotação de token durante a sessão nem limite de sessões simultâneas.
- `AUTH_PEPPER` passa a ser segredo obrigatório, com mínimo de 32 caracteres em produção.

Referências: [seguranca.md](../seguranca.md), [api.md](../api.md) e [banco.md](../banco.md).
