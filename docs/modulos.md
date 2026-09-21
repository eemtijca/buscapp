# Módulos

Regras de cada módulo do sistema, por papel. A referência das rotas está em [api.md](api.md); as entidades em [modelo-de-dados.md](modelo-de-dados.md).

## Módulos de acesso

O campo `perfis.acesso_modulos` libera recursos para professor e responsável. A verificação é fail-closed: lista vazia nega o acesso. A gestão não depende de módulos.

| Módulo          | Papel       | O que libera                                                  |
| --------------- | ----------- | ------------------------------------------------------------- |
| `frequencia`    | Professor   | Lançamento e consulta de frequências                          |
| `ocorrencias`   | Professor   | Criação e leitura de ocorrências e registros de comportamento |
| `alertas`       | Responsável | Leitura das ocorrências dos dependentes                       |
| `termometro`    | Responsável | Tela do termômetro de risco                                   |
| `justificativa` | Responsável | Envio e acompanhamento de justificativas                      |
| `chat`          | Responsável | Conversas e mensagens                                         |

As guardas do Vue Router espelham os mesmos módulos, e as páginas exibem aviso quando o acesso é negado.

## Frequência

O registro é por exceção: o professor envia apenas os ausentes da turma em um período, e quem não aparece na lista fica como presente.

- `POST /api/frequencias/lote` recebe `turma_id`, `data_aula`, `periodo`, `tipo_registro` (`chamada_aula`, `entrada_portao` ou `saida`), a lista de `ausentes` e um `client_request_id`. O reenvio com o mesmo identificador responde `200` com `idempotente: true` em vez de duplicar.
- `DELETE /api/frequencias/lote` desfaz a chamada do período, aplicando soft delete nos registros.
- `POST /api/frequencias` registra uma ausência individual, também idempotente quando recebe `client_request_id`.
- O índice `idx_frequencias_unicidade` impede duplicidade por aluno, data, tipo, período e disciplina enquanto o registro não estiver deletado.
- `GET /api/frequencias/resumo` alimenta os painéis de risco com totais de ausentes e justificados por aluno.
- O professor só enxerga alunos das turmas em que possui atribuição ativa. A gestão enxerga todos.

## Ocorrências e comportamento

- A ocorrência tem descrição (mínimo de 10 caracteres), um ou mais tipos do catálogo, status (`aberta`, `em_andamento`, `resolvida` ou `arquivada`), tags de comportamento e flags de notificação.
- `exige_presenca_responsavel` marca a ocorrência que precisa de comparecimento; a gestão confirma a presença em `PATCH /api/ocorrencias/:id`.
- O trigger `fn_notificar_ocorrencia` cria notificações para os responsáveis vinculados quando `notificar_responsavel` está ativo.
- Os registros de comportamento são anotações com tags, usados no cálculo de pontuação e no ranking. O professor precisa do módulo `ocorrencias` para criar ocorrências e registros de comportamento; a leitura de ambos segue as verificações de escopo.
- A gestão enxerga todas as ocorrências e alterna bloqueio e desbloqueio de retorno pela confirmação de presença.

## Justificativas

- O responsável envia a justificativa para um dependente, com data inicial, data final opcional, motivo e anexos já criados em `/api/anexos`.
- A gestão também pode lançar manualmente e é a única que avalia.
- Ao aceitar, o trigger `fn_auto_justificar_frequencias` marca como justificadas as frequências do aluno no intervalo de `data_falta` a `data_fim`.
- Ao recusar, a justificativa permanece no histórico com o parecer.
- O responsável precisa do módulo `justificativa`; a listagem da gestão tem filtros por status, aluno e intervalo de datas, formando a fila de pendentes.

## Chat

- Cada par responsável e aluno tem uma única conversa, obtida ou criada em `POST /api/conversas`. A gestão inicia conversas com quaisquer responsáveis; o responsável inicia com os próprios dependentes.
- O responsável só envia mensagens dentro das janelas de `horarios_letivos`; fora delas a API responde `403` com `fora_horario`. A verificação é feita no servidor.
- Mensagens aceitam `client_request_id` para reenvio idempotente, o que apoia a recuperação após quedas de rede.
- Ocultar uma conversa (`ativa: false`) não remove o histórico; uma nova mensagem a reabre e o trigger `fn_notificar_nova_mensagem` cria a notificação de mensagem.
- Mensagens de sistema registram eventos da conversa e não são editáveis.
- A leitura marca as mensagens recebidas em `PATCH /api/conversas/:id/lidas`.

## Notificações

- Os tipos são `ausencia_portao`, `ausencia_aula`, `monitoramento`, `ocorrencia`, `justificativa`, `mensagem`, `sistema` e `codigo_redefinicao`.
- Quem recebe é sempre o destinatário; as rotas de leitura e alteração são restritas a ele.
- O frontend combina o stream SSE com polling de segurança a cada 30 segundos.

## Monitoramento, termômetro e ranking

- A tabela `monitoramento_acoes` e a rota de importação de planilhas não têm rotas HTTP hoje: o registro de tentativas de contato existe no schema e no seed, sem uso pela interface.
- O termômetro de risco e o ranking de priorização de risco dos alunos são calculados no frontend (`apps/web/src/composables/consultas/useMonitoramento.ts` e `apps/web/src/servicos/termometro.ts`) a partir de frequências, ocorrências, registros de comportamento e dos pesos de `configuracoes_sistema` (faltas, ocorrências, recência, limites de score e bônus).
- A gestão acompanha infrequências, termômetro e ranking; o responsável vê o termômetro dos dependentes.

## Estrutura escolar

- O ano letivo tem status (`planejado`, `ativo`, `arquivado`) e a virada em `POST /api/anos-letivos/:id/ativar` arquiva o ano vigente e ativa o novo em uma transação, com auditoria.
- O `nome_completo` da turma é preenchido pelo trigger `fn_set_turma_nome` a partir de série e letra.
- A enturmação encerra a anterior do aluno no mesmo ano e mantém o histórico.
- As atribuições de professor têm vigência e papel (`titular` ou `substituto`), e definem o escopo de leitura do professor.

## Catálogos e configurações

- Os catálogos de `opcoes_configuracao` cobrem módulos, documentos, períodos, motivos de ausência, tipos de ocorrência, vínculos, papéis de atribuição, séries e letras. As chaves são validadas por CHECK nas tabelas que as referenciam.
- Opções e tags referenciadas não podem ser excluídas; a orientação é desativar.
- `tags_comportamento` define categoria e peso, usados na pontuação.
- `configuracoes_sistema` concentra limites de faltas, pesos do termômetro, dias de expurgo e parâmetros dos códigos. A gestão lê o registro completo em `GET /api/configuracoes`; os demais perfis recebem apenas o subconjunto público (`GET /api/configuracoes/publicas`) com escola, fuso, mensagem fora de horário e parâmetros do termômetro. As janelas de expurgo são aplicadas pela rotina agendada `POST /api/tarefas/expurgo`.
- `horarios_letivos` define as janelas de atendimento do chat.

## Auditoria

- A trilha registra login, falhas de login, logout, revogação de sessões, CRUD de usuários e alunos, criação/remoção/download de anexos, expurgo, anonimização e viradas de ano, sempre com `ip_origem`.
- `GET /api/auditoria` (gestão) lista os eventos com filtros por ação, entidade, usuário e intervalo, com paginação. A tela **Auditoria** em `/gestao/auditoria` consome a rota.
- Downloads de anexo gravam `BAIXAR_ANEXO` antes de iniciar o streaming.
