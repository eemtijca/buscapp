# Referência da API

Rotas HTTP da API Fastify. Todas ficam sob `/api` e respondem JSON, exceto o download de anexo e o stream SSE. Os contratos de entrada e saída ficam em `packages/contratos/src/`.

## Convenções

- **Sessão:** rotas privadas resolvem o usuário pelo cookie `buscapp_sessao` (HttpOnly). Sem sessão válida respondem `401` com `{ erro: { codigo: 'nao_autenticado', mensagem } }`. A exceção é `GET /api/auth/me`, uma sonda que sempre responde `200` com `perfil: null` quando não há sessão, para o frontend descobrir o estado sem gerar erro. O frontend usa `credentials: 'include'`.
- **Erros:** envelope único `{ "erro": { "codigo": "string", "mensagem": "string" } }`. O status indica a categoria: `400` validação ou regra de negócio, `401` sem sessão, `403` sem permissão, `404` recurso ausente ou fora do escopo, `413` arquivo grande e `429` tentativas de código excedidas.
- **Papel e módulo:** `exigirPapel` valida o papel e `exigirModulo` aplica `acesso_modulos` com semântica fail-closed. A gestão não passa por módulos; professor e responsável dependem dos módulos habilitados.
- **Escopo:** toda leitura filtra pelos alunos visíveis ao perfil. Recurso fora do escopo responde `404`, para não revelar a existência.
- **Idempotência:** frequências, mensagens e registros de comportamento aceitam `client_request_id` com índice único parcial.
- **Datas:** datas civis usam `yyyy-mm-dd` e timestamps usam ISO 8601.
- **Listas:** os endpoints de listagem devolvem arrays completos nomeados pela coleção. A única paginação é a de notificações (`limite`, de 1 a 100, padrão 20).
- **Uploads:** `multipart/form-data` no endpoint clássico ou URL pré-assinada no fluxo direto. Ver [modulos.md](modulos.md).

## Resumo das rotas

| Método                 | Caminho                                                  | Acesso                            | Descrição                                                                  |
| ---------------------- | -------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| GET                    | `/api/saude`                                             | Público                           | Liveness da API, sem consulta ao banco                                     |
| GET                    | `/api/eventos`                                           | Sessão                            | Stream SSE de invalidação                                                  |
| POST                   | `/api/auth/login`                                        | Público                           | Inicia a sessão                                                            |
| POST                   | `/api/auth/logout`                                       | Público                           | Revoga a sessão e limpa o cookie                                           |
| GET                    | `/api/auth/me`                                           | Público (sonda)                   | Perfil da sessão ou `null`                                                 |
| POST                   | `/api/auth/solicitar-codigo`                             | Público                           | Solicita código, notificando a gestão                                      |
| POST                   | `/api/auth/redefinir-senha`                              | Público                           | Define a senha com o código                                                |
| GET                    | `/api/usuarios`                                          | Gestão                            | Lista perfis com filtros `papel`, `status` e `busca`                       |
| GET                    | `/api/usuarios/:id`                                      | Gestão                            | Consulta um perfil                                                         |
| POST                   | `/api/usuarios`                                          | Gestão                            | Cria perfil pendente com código e senha temporária                         |
| PUT                    | `/api/usuarios/:id`                                      | Gestão                            | Atualiza dados e módulos de acesso                                         |
| PATCH                  | `/api/usuarios/:id/status`                               | Gestão                            | Ativa ou inativa perfil                                                    |
| GET                    | `/api/alunos`                                            | Todos                             | Lista alunos visíveis, com `busca` e `status`                              |
| GET                    | `/api/alunos/:id`                                        | Todos                             | Consulta aluno visível                                                     |
| POST                   | `/api/alunos`                                            | Gestão                            | Cria aluno                                                                 |
| PUT                    | `/api/alunos/:id`                                        | Gestão                            | Atualiza aluno                                                             |
| GET                    | `/api/turmas`                                            | Todos                             | Lista turmas, com `ativo` e `ano_letivo_id`                                |
| POST, PUT              | `/api/turmas`, `/api/turmas/:id`                         | Gestão                            | Cria e atualiza turma                                                      |
| PATCH                  | `/api/turmas/:id/status`                                 | Gestão                            | Ativa ou inativa turma                                                     |
| GET, POST, PUT         | `/api/disciplinas`, `/api/disciplinas/:id`               | Consulta: todos; escrita: gestão  | Disciplinas                                                                |
| PATCH                  | `/api/disciplinas/:id/status`                            | Gestão                            | Ativa ou inativa disciplina                                                |
| GET, POST, PUT         | `/api/atribuicoes`, `/api/atribuicoes/:id`               | Gestão                            | Atribuições professor, turma e disciplina                                  |
| PATCH                  | `/api/atribuicoes/:id/status`                            | Gestão                            | Ativa ou encerra atribuição                                                |
| GET, POST, PUT         | `/api/anos-letivos`, `/api/anos-letivos/:id`             | Gestão                            | Anos letivos                                                               |
| POST                   | `/api/anos-letivos/:id/ativar`                           | Gestão                            | Virada de ano, com auditoria                                               |
| GET, POST, PUT         | `/api/enturmacoes`, `/api/enturmacoes/:id`               | Consulta: todos; escrita: gestão  | Enturmações                                                                |
| GET, POST, PUT         | `/api/vinculos`, `/api/vinculos/:id`                     | Consulta: todos; escrita: gestão  | Vínculos responsável-aluno                                                 |
| POST                   | `/api/frequencias/lote`                                  | Gestão e professor                | Chamada por exceção, idempotente                                           |
| DELETE                 | `/api/frequencias/lote`                                  | Gestão e professor                | Desfaz a chamada do período                                                |
| POST                   | `/api/frequencias`                                       | Gestão e professor                | Ausência individual, idempotente                                           |
| GET                    | `/api/frequencias`                                       | Todos                             | Lista com filtros por aluno, turma, data, status e tipo                    |
| GET                    | `/api/frequencias/:id`                                   | Todos                             | Consulta uma frequência                                                    |
| GET                    | `/api/frequencias/resumo`                                | Todos                             | Resumo por aluno para os painéis                                           |
| GET                    | `/api/ocorrencias`                                       | Todos                             | Lista com filtros `aluno_id`, `status`, `tipo` e `exige_presenca_pendente` |
| GET                    | `/api/ocorrencias/:id`                                   | Todos                             | Consulta uma ocorrência                                                    |
| POST                   | `/api/ocorrencias`                                       | Gestão e professor                | Cria ocorrência                                                            |
| PATCH                  | `/api/ocorrencias/:id`                                   | Gestão                            | Atualiza status e presença do responsável                                  |
| GET                    | `/api/registros-comportamento`                           | Todos                             | Lista registros com `aluno_id` e intervalo de datas                        |
| POST                   | `/api/registros-comportamento`                           | Gestão e professor                | Cria registro de comportamento                                             |
| GET                    | `/api/justificativas`                                    | Todos                             | Lista com filtros `status`, `aluno_id` e intervalo                         |
| GET                    | `/api/justificativas/:id`                                | Todos                             | Consulta uma justificativa                                                 |
| POST                   | `/api/justificativas`                                    | Gestão e responsável              | Cria justificativa, com `anexo_ids` opcionais                              |
| PATCH                  | `/api/justificativas/:id`                                | Gestão                            | Aceita ou recusa, disparando a auto-justificativa                          |
| GET                    | `/api/conversas`                                         | Todos                             | Lista conversas visíveis                                                   |
| POST                   | `/api/conversas`                                         | Gestão e responsável              | Obtém ou cria conversa por aluno                                           |
| GET                    | `/api/conversas/:id/mensagens`                           | Participantes                     | Lista mensagens não removidas                                              |
| POST                   | `/api/conversas/:id/mensagens`                           | Participantes                     | Envia mensagem, com horário protegido para o responsável                   |
| PATCH                  | `/api/conversas/:id/lidas`                               | Participantes                     | Marca as mensagens recebidas como lidas                                    |
| PATCH                  | `/api/conversas/:id`                                     | Participantes                     | Oculta ou reexibe a conversa                                               |
| GET                    | `/api/notificacoes`                                      | Sessão                            | Notificações do próprio usuário, com `limite` e `lida`                     |
| PATCH                  | `/api/notificacoes/lidas`                                | Sessão                            | Marca todas como lidas                                                     |
| PATCH                  | `/api/notificacoes/conversa/:conversaId/lidas`           | Sessão                            | Marca as notificações da conversa                                          |
| PATCH                  | `/api/notificacoes/:id/lida`                             | Sessão                            | Marca uma notificação                                                      |
| DELETE                 | `/api/notificacoes`                                      | Sessão                            | Remove todas as notificações do usuário                                    |
| POST                   | `/api/anexos/upload`                                     | Todos                             | Gera URL pré-assinada para envio direto                                    |
| POST                   | `/api/anexos/confirmar`                                  | Todos                             | Confirma o envio direto e registra os metadados                            |
| POST                   | `/api/anexos`                                            | Todos                             | Envia anexo por multipart                                                  |
| GET                    | `/api/anexos/:id/arquivo`                                | Todos                             | Baixa o anexo em streaming, com autorização                                |
| DELETE                 | `/api/anexos/:id`                                        | Todos                             | Remove anexo do criador ou da gestão                                       |
| GET                    | `/api/configuracoes`                                     | Sessão                            | Parâmetros do sistema                                                      |
| PUT                    | `/api/configuracoes`                                     | Gestão                            | Atualiza parâmetros do sistema                                             |
| GET, POST, PUT, DELETE | `/api/opcoes`, `/api/opcoes/:id`                         | Consulta: sessão; escrita: gestão | Catálogos genéricos                                                        |
| PATCH                  | `/api/opcoes/reordenar`                                  | Gestão                            | Reordena opções em transação                                               |
| GET, POST, PUT, DELETE | `/api/horarios`, `/api/horarios/:id`                     | Consulta: sessão; escrita: gestão | Janelas de horário do chat                                                 |
| PATCH                  | `/api/horarios/:id/status`                               | Gestão                            | Ativa ou inativa horário                                                   |
| GET                    | `/api/tags-comportamento`                                | Sessão                            | Lista tags, com `ativo`                                                    |
| POST, PUT, DELETE      | `/api/tags-comportamento`, `/api/tags-comportamento/:id` | Gestão                            | Tags de comportamento                                                      |
| PATCH                  | `/api/tags-comportamento/:id/status`                     | Gestão                            | Ativa ou inativa tag                                                       |
| GET                    | `/api/codigos`                                           | Gestão                            | Lista códigos com status derivado e bloqueio                               |
| POST                   | `/api/codigos/perfil/:perfilId`                          | Gestão                            | Gera código de 6 dígitos                                                   |
| PATCH                  | `/api/codigos/:id/revogar`                               | Gestão                            | Revoga código                                                              |
| POST                   | `/api/codigos/limpar`                                    | Gestão                            | Remove códigos usados, expirados e revogados                               |

> [!NOTE]
> Não existem rotas de agregação em `/api/monitoramento`. O ranking e o termômetro são calculados no frontend a partir das rotas de frequências, ocorrências, registros de comportamento e configurações. Ver [modulos.md](modulos.md).

## Saúde e eventos

### `GET /api/saude`

Responde `200` com `{ "status": "ok", "hora": "ISO" }`. É apenas liveness: não consulta o banco. O frontend usa a rota no indicador de conexão.

### `GET /api/eventos`

Stream SSE autenticado. Envia `event: invalidar` com `{ tabela, escopo }`, além de `: ping` a cada 25 segundos. O navegador reconecta sozinho e o frontend recarrega as telas inscritas na tabela do evento. Ver [modulos.md](modulos.md).

## Autenticação

### `POST /api/auth/login`

Corpo: `email`, `senha` e `lembrar` opcional. Responde `200` com `{ perfil }` e grava o cookie de sessão. Credenciais inválidas respondem `401` com `credenciais_invalidas`; perfil inativo responde `403` com `conta_inativa`. O tempo de resposta é equalizado com um hash falso quando o email não existe.

### `POST /api/auth/logout`

Revoga a sessão do cookie e o limpa. Responde `200`.

### `GET /api/auth/me`

Sonda a sessão sem falhar: responde `200` com `{ perfil }` quando o cookie é válido, ou `{ perfil: null }` quando não há cookie, a sessão expirou ou foi revogada. O `perfil` segue o `perfilAutenticadoSchema` (id, nome, email, papel, status, telefone, cargo, notificacoes_ativas e acesso_modulos).

### `POST /api/auth/solicitar-codigo`

Corpo: `email`. Sempre responde `200` com `{ ok: true }`, sem revelar se a conta existe. Quando a conta é elegível, notifica a gestão ativa, com deduplicação de notificações pendentes.

### `POST /api/auth/redefinir-senha`

Corpo: `email`, `codigo` (6 dígitos) e `novaSenha`. Exige a política de senha forte (mínimo de 8 com maiúscula, minúscula, dígito e símbolo). Código inválido, expirado ou usado responde `400` com `codigo_invalido`; excesso de tentativas responde `429` com `muitas_tentativas`. No sucesso, revoga as sessões, ativa perfis pendentes e audita.

## Usuários e códigos

### `POST /api/usuarios`

Corpo: `nome`, `email`, `papel`, `telefone`, `cargo` e `acesso_modulos` opcionais. Responde `201` com `{ usuario, codigo, senha_temporaria }`. O código é exibido uma única vez.

### `PATCH /api/usuarios/:id/status`

Corpo: `{ "status": "ativo" | "inativo" }`. Inativar revoga as sessões. A própria conta não pode ser inativada (`400 auto_inativacao`).

### `POST /api/codigos/perfil/:perfilId`

Gera um código de 6 dígitos para o perfil, revogando códigos ativos anteriores. Responde `201` com o código em texto puro, exibido uma única vez. O banco guarda apenas o HMAC.

## Frequências

### `POST /api/frequencias/lote`

Chamada por exceção: envia apenas os ausentes. Corpo: `turma_id`, `data_aula` (`yyyy-mm-dd`), `periodo`, `tipo_registro` (`chamada_aula`, `entrada_portao` ou `saida`), `ausentes` (lista com `aluno_id`, `observacao` e `motivos_ausencia`) e `client_request_id`. Responde `201` com `{ registradas }` ou `200` com `{ idempotente: true }` quando o identificador já foi processado.

### `DELETE /api/frequencias/lote`

Desfaz a chamada. Recebe `turma_id`, `data_aula`, `periodo` e `tipo_registro` na query string. Os registros usam soft delete.

### `GET /api/frequencias/resumo`

Recebe `aluno_ids` (um ou vários) e intervalo opcional. Responde `200` com `{ resumos }`, cada um com `aluno_id`, `total_ausentes`, `total_justificados` e os registros do período.

## Ocorrências e comportamento

### `POST /api/ocorrencias`

Corpo: `aluno_id`, `descricao` (mínimo de 10 caracteres), `tipo` (lista), `titulo` opcional, `exige_presenca_responsavel`, `tags_comportamento`, `notificar_coordenacao`, `notificar_responsavel` e `turma_id` opcional. O trigger `fn_notificar_ocorrencia` avisa os responsáveis quando a notificação está habilitada.

### `PATCH /api/ocorrencias/:id`

Corpo restrito à gestão: `status`, `exige_presenca_responsavel` e `presenca_responsavel_confirmada`.

## Justificativas

### `POST /api/justificativas`

Corpo: `aluno_id`, `data_falta`, `data_fim` opcional, `motivo` e `anexo_ids` opcionais. O responsável envia para os próprios dependentes; a gestão pode lançar manualmente.

### `PATCH /api/justificativas/:id`

Corpo: `{ "status": "aceita" | "recusada" }`. O aceite dispara `fn_auto_justificar_frequencias`, que marca as frequências do período como justificadas.

## Chat

### `POST /api/conversas`

Corpo: `aluno_id` e `responsavel_id` opcional. Obtém ou cria a conversa única do par responsável e aluno. Responde `200` quando já existe ou `201` quando cria.

### `POST /api/conversas/:id/mensagens`

Corpo: `conteudo` (até 2000 caracteres) e `client_request_id` opcional. Responde `201` ou `200` quando idempotente. O responsável só envia dentro das janelas de `horarios_letivos`; fora delas responde `403` com `fora_horario`.

## Notificações

`GET /api/notificacoes` aceita `limite` (1 a 100, padrão 20) e `lida`. Responde `{ notificacoes, nao_lidas }`. As rotas `PATCH` marcam como lidas e `DELETE` remove todas as notificações do usuário, sempre restritas ao destinatário.

## Anexos

### `POST /api/anexos/upload`

Corpo: `nome_arquivo`, `mime_type` (JPEG, PNG, WEBP ou PDF) e `tamanho_bytes`. Responde `200` com `{ upload: { chave, url, expira_em } }`. Exige o driver S3; com disco responde `400` com `upload_direto_indisponivel`. Arquivos acima de `UPLOAD_DIRETO_MAX_BYTES` respondem `413`.

### `POST /api/anexos/confirmar`

Corpo: `chave`, `nome_arquivo`, `mime_type` e `tamanho_bytes`. Valida que a chave pertence ao usuário, confere tamanho e tipo no provedor e cria o registro. É idempotente por `storage_path`.

### `POST /api/anexos`

`multipart/form-data` com o campo `arquivo`, até 10 MB. É o caminho usado pelo driver de disco e o fallback do upload direto.

### `GET /api/anexos/:id/arquivo`

Baixa o conteúdo em streaming, com `Content-Type`, `Content-Length`, `Content-Disposition: inline` e `Cache-Control: private, no-store`. A autorização aceita o criador, a gestão ou quem pode ver o aluno associado.

## Configurações e catálogos

- `GET /api/configuracoes` devolve os parâmetros globais; `PUT` fica restrito à gestão.
- `/api/opcoes` cobre os catálogos genéricos, com reordenação em transação e bloqueio de exclusão de opções referenciadas.
- `/api/horarios` define as janelas de atendimento do chat.
- `/api/tags-comportamento` define o catálogo de tags usado em ocorrências e registros.
