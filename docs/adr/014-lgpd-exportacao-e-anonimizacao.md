# ADR-014: exportação e anonimização de dados do titular

- Estado: aceita.
- Data: 2026.

## Contexto

A LGPD garante ao titular os direitos de acesso, correção, anonimização, bloqueio e eliminação de dados desnecessários ou excessivos. O sistema guarda dados de alunos e responsáveis, e não havia fluxo para atender a esses pedidos.

## Decisão

1. `GET /api/lgpd/alunos/:id/exportar` devolve o pacote de dados do aluno (cadastro, responsáveis, frequências, ocorrências, justificativas, registros de comportamento e metadados de anexos), restrito à gestão.
2. `POST /api/lgpd/alunos/:id/anonimizar` anonimiza os campos pessoais, substitui textos livres por marcadores e remove os anexos vinculados, preservando frequências para estatística.
3. A eliminação exige `confirmar: true` no corpo e é registrada na auditoria com o estado anterior.
4. O histórico de frequência é mantido de forma anônima; conversas de chat não são alteradas nesta versão.

## Alternativas consideradas

- Exclusão em cascata: descartada por destruir histórico escolar e afetar indicadores agregados.
- Exportação em arquivo assíncrono: descartada pela complexidade; o volume por aluno é pequeno.
- Eliminar também os registros de frequência: descartada por conflitar com a finalidade de acompanhamento escolar.

## Consequências

- Pedidos de titular têm fluxo único, auditável e irreversível.
- A anonimização é definitiva; a exportação deve ser feita antes, se necessário.
- A matrícula é substituída por um identificador anônimo único.

Referências: [seguranca.md](../seguranca.md), [api.md](../api.md) e [modelo-de-dados.md](../modelo-de-dados.md).
