# ADR-004: anexos atrás de interface, com upload direto

- Estado: aceita.
- Data: 2026.

## Contexto

Anexos precisam funcionar em disco no ambiente local e em provedores compatíveis com S3 na nuvem. Em serverless, a função limita o corpo da requisição e da resposta a 4,5 MB, o que inviabiliza enviar e devolver arquivos maiores pelo processo da API.

## Decisão

Manter a interface `Armazenamento` com drivers de disco e S3 e oferecer dois caminhos de upload:

1. Multipart em `POST /api/anexos`, para disco e como fallback.
2. Upload direto com URL pré-assinada em `POST /api/anexos/upload`, confirmação em `POST /api/anexos/confirmar` e download em streaming.

## Alternativas consideradas

- Somente multipart: descartada pelo limite de 4,5 MB em serverless.
- Somente URL pré-assinada: descartada porque o driver de disco não tem o conceito.
- Armazenamento proprietário da plataforma: descartada pela portabilidade.

## Consequências

- Arquivos grandes não passam pela função, e o download usa streaming.
- Há dois caminhos de upload a manter, com fallback automático no frontend.
- A confirmação valida chave prefixada pelo usuário, tamanho e tipo no provedor.
- Buckets no Supabase Storage devem usar underscore no nome para o formato path-style.
- Não há inspeção de bytes mágicos nem varredura de conteúdo.

Referências: [modulos.md](../modulos.md), [api.md](../api.md) e [seguranca.md](../seguranca.md).
