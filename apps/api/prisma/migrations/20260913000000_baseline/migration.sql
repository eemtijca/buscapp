-- Baseline do schema público do BuscApp.
-- Gerado por `prisma migrate diff` a partir do schema introspectado, complementado com
-- extensões, índice de expressão e CHECKs de integridade que o schema Prisma não representa.

-- Extensões necessárias (gen_random_uuid, crypt/gen_salt, busca trigram)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "categoria_tag" AS ENUM ('positivo', 'atencao', 'critico');

-- CreateEnum
CREATE TYPE "papel_perfil" AS ENUM ('professor', 'gestao', 'responsavel');

-- CreateEnum
CREATE TYPE "status_aluno" AS ENUM ('ativo', 'egresso', 'transferido', 'inativo');

-- CreateEnum
CREATE TYPE "status_ano_letivo" AS ENUM ('planejado', 'ativo', 'arquivado');

-- CreateEnum
CREATE TYPE "status_exportacao" AS ENUM ('agendada', 'processando', 'concluida', 'falhou');

-- CreateEnum
CREATE TYPE "status_frequencia" AS ENUM ('presente', 'ausente', 'justificado');

-- CreateEnum
CREATE TYPE "status_importacao" AS ENUM ('processando', 'concluido', 'parcial', 'falhou');

-- CreateEnum
CREATE TYPE "status_justificativa" AS ENUM ('pendente', 'aceita', 'recusada');

-- CreateEnum
CREATE TYPE "status_monitoramento" AS ENUM ('pendente', 'em_andamento', 'realizado', 'sem_contato', 'cancelado');

-- CreateEnum
CREATE TYPE "status_ocorrencia" AS ENUM ('aberta', 'em_andamento', 'resolvida', 'arquivada');

-- CreateEnum
CREATE TYPE "status_perfil" AS ENUM ('ativo', 'pendente', 'inativo');

-- CreateEnum
CREATE TYPE "tipo_contato_busca" AS ENUM ('telefone', 'whatsapp', 'presencial', 'carta', 'outro');

-- CreateEnum
CREATE TYPE "tipo_notificacao" AS ENUM ('ausencia_portao', 'ausencia_aula', 'monitoramento', 'ocorrencia', 'justificativa', 'mensagem', 'sistema', 'codigo_redefinicao');

-- CreateEnum
CREATE TYPE "tipo_registro_frequencia" AS ENUM ('entrada_portao', 'chamada_aula', 'saida');

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "codigo_inep" TEXT,
    "status" "status_aluno" NOT NULL DEFAULT 'ativo',
    "observacoes" TEXT,
    "data_nascimento" DATE,
    "data_matricula" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transporte_escolar" BOOLEAN NOT NULL DEFAULT false,
    "alimentacao_diferenciada" BOOLEAN NOT NULL DEFAULT false,
    "necessidades_especiais" BOOLEAN NOT NULL DEFAULT false,
    "documentos_recebidos" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storage_path" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "criado_por" UUID,
    "expurgo_em" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '30 days'::interval),
    "expurgado_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMPTZ(6),

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anos_letivos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ano" INTEGER NOT NULL,
    "status" "status_ano_letivo" NOT NULL DEFAULT 'planejado',
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atribuicoes_professores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "professor_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "papel" TEXT NOT NULL DEFAULT 'titular',
    "data_inicio" DATE NOT NULL DEFAULT CURRENT_DATE,
    "data_fim" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atribuicoes_professores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" UUID,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "ip_origem" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_redefinicao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "perfil_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "criado_por" UUID,
    "usado_em" TIMESTAMPTZ(6),
    "expira_em" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '01:00:00'::interval),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogado_em" TIMESTAMPTZ(6),

    CONSTRAINT "codigos_redefinicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_redefinicao_tentativas" (
    "email" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_redefinicao_tentativas_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "configuracoes_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "limite_critico_faltas" INTEGER NOT NULL DEFAULT 25,
    "limite_preventivo_faltas" INTEGER NOT NULL DEFAULT 10,
    "dias_expurgo_anexos" INTEGER NOT NULL DEFAULT 30,
    "escola_nome" TEXT NOT NULL DEFAULT 'EEMTI',
    "mensagem_fora_horario" TEXT NOT NULL DEFAULT 'O canal de diálogo está fora do horário escolar. Mensagens enviadas agora serão respondidas quando a coordenação estiver disponível.',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutos_validade_codigo" INTEGER NOT NULL DEFAULT 60,
    "max_tentativas_codigo" INTEGER NOT NULL DEFAULT 5,
    "minutos_bloqueio_codigo" INTEGER NOT NULL DEFAULT 15,
    "dias_retencao_codigos" INTEGER NOT NULL DEFAULT 30,
    "peso_falta" DECIMAL NOT NULL DEFAULT 1.0,
    "peso_ocorrencia" DECIMAL NOT NULL DEFAULT 1.0,
    "peso_recencia" DECIMAL NOT NULL DEFAULT 1.0,
    "janela_recencia_dias" INTEGER NOT NULL DEFAULT 14,
    "limite_score_medio" INTEGER NOT NULL DEFAULT 40,
    "limite_score_alto" INTEGER NOT NULL DEFAULT 75,
    "peso_ocorrencia_grave" DECIMAL NOT NULL DEFAULT 15,
    "forcar_medio_em_grave" BOOLEAN NOT NULL DEFAULT true,
    "janela_ocorrencia_dias" INTEGER NOT NULL DEFAULT 90,
    "decaimento_ocorrencia_tipo" TEXT NOT NULL DEFAULT 'janela',
    "peso_resolvida" DECIMAL NOT NULL DEFAULT 0.5,
    "peso_comportamento_positivo" DECIMAL NOT NULL DEFAULT 5,
    "janela_positivo_dias" INTEGER NOT NULL DEFAULT 30,
    "bonus_presenca_confirmada" DECIMAL NOT NULL DEFAULT 10,

    CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID NOT NULL,
    "responsavel_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "assunto" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "iniciada_pela_gestao" BOOLEAN NOT NULL DEFAULT false,
    "ultima_mensagem_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "papel" "papel_perfil" NOT NULL,
    "nome_convidado" TEXT,
    "enviado_por" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "aceito_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "codigo_sige" TEXT,
    "carga_horaria" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enturmacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "ano_letivo_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'matriculado',
    "data_matricula" DATE NOT NULL DEFAULT CURRENT_DATE,
    "data_encerramento" DATE,
    "observacoes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enturmacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exportacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coordenador_id" UUID,
    "tipo" TEXT NOT NULL,
    "turma_id" UUID,
    "ano_letivo_id" UUID NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "formato" TEXT NOT NULL,
    "arquivo_path" TEXT,
    "status" "status_exportacao" NOT NULL DEFAULT 'agendada',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "exportacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "professor_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "ano_letivo_id" UUID NOT NULL,
    "data_aula" DATE NOT NULL,
    "tipo_registro" "tipo_registro_frequencia" NOT NULL DEFAULT 'chamada_aula',
    "periodo" TEXT NOT NULL,
    "status" "status_frequencia" NOT NULL DEFAULT 'presente',
    "observacao" TEXT,
    "client_request_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivos_ausencia" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "frequencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_letivos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_letivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coordenador_id" UUID,
    "ano_letivo_id" UUID NOT NULL,
    "arquivo_nome" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "mapeamento" JSONB NOT NULL,
    "total_registros" INTEGER DEFAULT 0,
    "registros_criados" INTEGER DEFAULT 0,
    "registros_atualizados" INTEGER DEFAULT 0,
    "erros" JSONB,
    "status" "status_importacao" NOT NULL DEFAULT 'processando',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificativa_anexos" (
    "justificativa_id" UUID NOT NULL,
    "anexo_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificativa_anexos_pkey" PRIMARY KEY ("justificativa_id","anexo_id")
);

-- CreateTable
CREATE TABLE "justificativas_faltas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "responsavel_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "frequencia_id" UUID,
    "data_falta" DATE NOT NULL,
    "data_fim" DATE,
    "motivo" TEXT NOT NULL,
    "status" "status_justificativa" NOT NULL DEFAULT 'pendente',
    "avaliado_por" UUID,
    "avaliado_em" TIMESTAMPTZ(6),
    "parecer" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificativas_faltas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversa_id" UUID NOT NULL,
    "remetente_id" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "is_system_message" BOOLEAN NOT NULL DEFAULT false,
    "lida_em" TIMESTAMPTZ(6),
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "client_request_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoramento_acoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "responsavel_id" UUID,
    "tipo_contato" "tipo_contato_busca" NOT NULL,
    "status" "status_monitoramento" NOT NULL DEFAULT 'pendente',
    "realizado_por" UUID,
    "observacao" TEXT,
    "agendado_para" TIMESTAMPTZ(6),
    "realizado_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoramento_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "destinatario_id" UUID NOT NULL,
    "tipo" "tipo_notificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT,
    "metadados" JSONB,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lida_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia_anexos" (
    "ocorrencia_id" UUID NOT NULL,
    "anexo_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencia_anexos_pkey" PRIMARY KEY ("ocorrencia_id","anexo_id")
);

-- CreateTable
CREATE TABLE "ocorrencias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "professor_id" UUID,
    "coordenador_id" UUID,
    "turma_id" UUID NOT NULL,
    "ano_letivo_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT[],
    "status" "status_ocorrencia" NOT NULL DEFAULT 'aberta',
    "exige_presenca_responsavel" BOOLEAN NOT NULL DEFAULT false,
    "presenca_responsavel_confirmada" BOOLEAN NOT NULL DEFAULT false,
    "data_confirmacao_presenca" TIMESTAMPTZ(6),
    "data_ocorrencia" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags_comportamento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificar_coordenacao" BOOLEAN NOT NULL DEFAULT true,
    "notificar_responsavel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcoes_configuracao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "icone" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opcoes_configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "papel_perfil" NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "cargo" TEXT,
    "notificacoes_ativas" BOOLEAN NOT NULL DEFAULT true,
    "status" "status_perfil" NOT NULL DEFAULT 'ativo',
    "ultimo_acesso_em" TIMESTAMPTZ(6),
    "acesso_modulos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontuacao_turmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID NOT NULL,
    "ano_letivo_id" UUID NOT NULL,
    "mes_referencia" DATE NOT NULL,
    "pontos_presenca" INTEGER NOT NULL DEFAULT 0,
    "pontos_comportamento" INTEGER NOT NULL DEFAULT 0,
    "pontos_total" INTEGER GENERATED ALWAYS AS (pontos_presenca + pontos_comportamento) STORED,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontuacao_turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_comportamento_tags" (
    "registro_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_comportamento_tags_pkey" PRIMARY KEY ("registro_id","tag_id")
);

-- CreateTable
CREATE TABLE "registros_comportamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID NOT NULL,
    "professor_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "ano_letivo_id" UUID NOT NULL,
    "data_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "client_request_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_comportamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags_comportamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "categoria" "categoria_tag" NOT NULL,
    "icone" TEXT,
    "descricao" TEXT,
    "peso_pontuacao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_comportamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ano_letivo_id" UUID NOT NULL,
    "serie" TEXT NOT NULL,
    "letra" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "capacidade" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos_responsaveis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "responsavel_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "tipo_relacao" TEXT NOT NULL DEFAULT 'outro',
    "contato_prioritario" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculos_responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_aluno_matricula" ON "alunos"("matricula");

-- CreateIndex
CREATE INDEX "idx_alunos_matricula" ON "alunos"("matricula");

-- CreateIndex
CREATE INDEX "idx_alunos_nome_trgm" ON "alunos" USING GIN ("nome" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_anexos_expurgo" ON "anexos"("expurgo_em") WHERE (expurgado_em IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_ano_letivo_ano" ON "anos_letivos"("ano");

-- CreateIndex
CREATE INDEX "idx_atribuicoes_professor" ON "atribuicoes_professores"("professor_id");

-- CreateIndex
CREATE INDEX "idx_atribuicoes_turma" ON "atribuicoes_professores"("turma_id");

-- CreateIndex
CREATE INDEX "idx_atribuicoes_vigente" ON "atribuicoes_professores"("professor_id") WHERE (ativo);

-- CreateIndex
CREATE INDEX "idx_auditoria_entidade" ON "auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "idx_auditoria_usuario" ON "auditoria"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_codigos_redefinicao_email" ON "codigos_redefinicao"("email");

-- CreateIndex
CREATE INDEX "idx_codigos_redefinicao_email_codigo" ON "codigos_redefinicao"("email", "codigo");

-- CreateIndex
CREATE INDEX "idx_conversas_responsavel" ON "conversas"("responsavel_id");

-- CreateIndex
CREATE INDEX "idx_conversas_turma" ON "conversas"("turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_conversa_responsavel_aluno" ON "conversas"("responsavel_id", "aluno_id");

-- CreateIndex
CREATE INDEX "idx_convites_status" ON "convites"("status", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "uq_disciplina_codigo_sige" ON "disciplinas"("codigo_sige");

-- CreateIndex
CREATE INDEX "idx_enturmacoes_aluno" ON "enturmacoes"("aluno_id");

-- CreateIndex
CREATE INDEX "idx_enturmacoes_ano" ON "enturmacoes"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "idx_enturmacoes_status" ON "enturmacoes"("status");

-- CreateIndex
CREATE INDEX "idx_enturmacoes_turma" ON "enturmacoes"("turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enturmacao_aluno_ano" ON "enturmacoes"("aluno_id", "ano_letivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_frequencia_client_req" ON "frequencias"("client_request_id");

-- CreateIndex
CREATE INDEX "idx_frequencias_aluno_data" ON "frequencias"("aluno_id", "data_aula");

-- CreateIndex
CREATE INDEX "idx_frequencias_ano" ON "frequencias"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "idx_frequencias_professor" ON "frequencias"("professor_id");

-- CreateIndex
CREATE INDEX "idx_frequencias_status" ON "frequencias"("status");

-- CreateIndex
CREATE INDEX "idx_frequencias_turma_data" ON "frequencias"("turma_id", "data_aula");

-- CreateIndex
CREATE UNIQUE INDEX "uq_horario_dia" ON "horarios_letivos"("dia_semana", "hora_inicio", "hora_fim");

-- CreateIndex
CREATE INDEX "idx_justificativas_aluno" ON "justificativas_faltas"("aluno_id");

-- CreateIndex
CREATE INDEX "idx_justificativas_responsavel" ON "justificativas_faltas"("responsavel_id");

-- CreateIndex
CREATE INDEX "idx_justificativas_status" ON "justificativas_faltas"("status") WHERE (status = 'pendente'::status_justificativa);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mensagem_client_req" ON "mensagens"("client_request_id");

-- CreateIndex
CREATE INDEX "idx_mensagens_conversa" ON "mensagens"("conversa_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_mensagens_nao_lidas" ON "mensagens"("conversa_id") WHERE (lida_em IS NULL);

-- CreateIndex
CREATE INDEX "idx_mensagens_remetente" ON "mensagens"("remetente_id");

-- CreateIndex
CREATE INDEX "idx_monitoramento_aluno" ON "monitoramento_acoes"("aluno_id");

-- CreateIndex
CREATE INDEX "idx_monitoramento_status" ON "monitoramento_acoes"("status") WHERE (status = ANY (ARRAY['pendente'::status_monitoramento, 'em_andamento'::status_monitoramento]));

-- CreateIndex
CREATE INDEX "idx_notificacoes_destinatario" ON "notificacoes"("destinatario_id", "lida", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ocorrencias_aluno" ON "ocorrencias"("aluno_id");

-- CreateIndex
CREATE INDEX "idx_ocorrencias_ano" ON "ocorrencias"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "idx_ocorrencias_presenca_pendente" ON "ocorrencias"("aluno_id") WHERE (exige_presenca_responsavel AND (NOT presenca_responsavel_confirmada));

-- CreateIndex
CREATE INDEX "idx_ocorrencias_status" ON "ocorrencias"("status");

-- CreateIndex
CREATE INDEX "idx_ocorrencias_turma" ON "ocorrencias"("turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "opcoes_configuracao_tipo_chave_key" ON "opcoes_configuracao"("tipo", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "uq_perfil_email" ON "perfis"("email");

-- CreateIndex
CREATE INDEX "idx_perfis_papel" ON "perfis"("papel") WHERE (status = 'ativo'::status_perfil);

-- CreateIndex
CREATE INDEX "idx_pontuacao_ranking" ON "pontuacao_turmas"("ano_letivo_id", "mes_referencia", "pontos_total" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pontuacao_turma_mes" ON "pontuacao_turmas"("turma_id", "ano_letivo_id", "mes_referencia");

-- CreateIndex
CREATE INDEX "idx_comportamento_tags_registro" ON "registro_comportamento_tags"("registro_id");

-- CreateIndex
CREATE INDEX "idx_comportamento_tags_tag" ON "registro_comportamento_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comportamento_client_req" ON "registros_comportamento"("client_request_id");

-- CreateIndex
CREATE INDEX "idx_comportamento_aluno_data" ON "registros_comportamento"("aluno_id", "data_hora");

-- CreateIndex
CREATE INDEX "idx_comportamento_ano" ON "registros_comportamento"("ano_letivo_id");

-- CreateIndex
CREATE INDEX "idx_comportamento_professor" ON "registros_comportamento"("professor_id");

-- CreateIndex
CREATE INDEX "idx_comportamento_turma_data" ON "registros_comportamento"("turma_id", "data_hora");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tag_nome" ON "tags_comportamento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_turma_ano_serie_letra" ON "turmas"("ano_letivo_id", "serie", "letra");

-- CreateIndex
CREATE INDEX "idx_vinculos_aluno" ON "vinculos_responsaveis"("aluno_id");

-- CreateIndex
CREATE INDEX "idx_vinculos_responsavel" ON "vinculos_responsaveis"("responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_vinculo_responsavel_aluno" ON "vinculos_responsaveis"("responsavel_id", "aluno_id");

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atribuicoes_professores" ADD CONSTRAINT "atribuicoes_professores_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atribuicoes_professores" ADD CONSTRAINT "atribuicoes_professores_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atribuicoes_professores" ADD CONSTRAINT "atribuicoes_professores_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "codigos_redefinicao" ADD CONSTRAINT "codigos_redefinicao_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "codigos_redefinicao" ADD CONSTRAINT "codigos_redefinicao_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enturmacoes" ADD CONSTRAINT "enturmacoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enturmacoes" ADD CONSTRAINT "enturmacoes_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enturmacoes" ADD CONSTRAINT "enturmacoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exportacoes" ADD CONSTRAINT "exportacoes_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exportacoes" ADD CONSTRAINT "exportacoes_coordenador_id_fkey" FOREIGN KEY ("coordenador_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exportacoes" ADD CONSTRAINT "exportacoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "frequencias" ADD CONSTRAINT "frequencias_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "importacoes_log" ADD CONSTRAINT "importacoes_log_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "importacoes_log" ADD CONSTRAINT "importacoes_log_coordenador_id_fkey" FOREIGN KEY ("coordenador_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativa_anexos" ADD CONSTRAINT "justificativa_anexos_anexo_id_fkey" FOREIGN KEY ("anexo_id") REFERENCES "anexos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativa_anexos" ADD CONSTRAINT "justificativa_anexos_justificativa_id_fkey" FOREIGN KEY ("justificativa_id") REFERENCES "justificativas_faltas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativas_faltas" ADD CONSTRAINT "justificativas_faltas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativas_faltas" ADD CONSTRAINT "justificativas_faltas_avaliado_por_fkey" FOREIGN KEY ("avaliado_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativas_faltas" ADD CONSTRAINT "justificativas_faltas_frequencia_id_fkey" FOREIGN KEY ("frequencia_id") REFERENCES "frequencias"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "justificativas_faltas" ADD CONSTRAINT "justificativas_faltas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoramento_acoes" ADD CONSTRAINT "monitoramento_acoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoramento_acoes" ADD CONSTRAINT "monitoramento_acoes_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoramento_acoes" ADD CONSTRAINT "monitoramento_acoes_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencia_anexos" ADD CONSTRAINT "ocorrencia_anexos_anexo_id_fkey" FOREIGN KEY ("anexo_id") REFERENCES "anexos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencia_anexos" ADD CONSTRAINT "ocorrencia_anexos_ocorrencia_id_fkey" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencias"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_coordenador_id_fkey" FOREIGN KEY ("coordenador_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pontuacao_turmas" ADD CONSTRAINT "pontuacao_turmas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pontuacao_turmas" ADD CONSTRAINT "pontuacao_turmas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registro_comportamento_tags" ADD CONSTRAINT "registro_comportamento_tags_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "registros_comportamento"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registro_comportamento_tags" ADD CONSTRAINT "registro_comportamento_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags_comportamento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registros_comportamento" ADD CONSTRAINT "registros_comportamento_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registros_comportamento" ADD CONSTRAINT "registros_comportamento_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registros_comportamento" ADD CONSTRAINT "registros_comportamento_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registros_comportamento" ADD CONSTRAINT "registros_comportamento_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registros_comportamento" ADD CONSTRAINT "registros_comportamento_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_ano_letivo_id_fkey" FOREIGN KEY ("ano_letivo_id") REFERENCES "anos_letivos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vinculos_responsaveis" ADD CONSTRAINT "vinculos_responsaveis_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vinculos_responsaveis" ADD CONSTRAINT "vinculos_responsaveis_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Índice único parcial com expressão (não representável no schema Prisma)

create unique index idx_frequencias_unicidade
  on public.frequencias (aluno_id, data_aula, tipo_registro, periodo, coalesce(disciplina_id::text, ''))
  where deleted_at is null;

-- Funções de validação de catálogo usadas pelas CHECKs de integridade
create or replace function public.fn_chave_catalogo_valida(p_tipo text, p_chave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opcoes_configuracao
    where tipo = p_tipo and chave = p_chave
  )
$$;

create or replace function public.fn_chaves_catalogo_validas(p_tipo text, p_chaves text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_chaves), 0) = 0
      or not exists (
        select 1 from unnest(p_chaves) as c(chave)
        where not exists (
          select 1 from public.opcoes_configuracao
          where tipo = p_tipo and chave = c.chave
        )
      )
$$;

create or replace function public.fn_tags_validas(p_nomes text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(p_nomes), 0) = 0
      or not exists (
        select 1 from unnest(p_nomes) as t(nome)
        where not exists (
          select 1 from public.tags_comportamento
          where nome = t.nome
        )
      )
$$;

-- CHECKs de integridade (extraídas do banco de referência)
ALTER TABLE ONLY public.alunos ADD CONSTRAINT chk_alunos_documentos_catalogo  CHECK (public.fn_chaves_catalogo_validas('documento'::text, documentos_recebidos));
ALTER TABLE ONLY public.anexos ADD CONSTRAINT chk_anexo_tamanho  CHECK ((tamanho_bytes <= 10485760));
ALTER TABLE ONLY public.anos_letivos ADD CONSTRAINT chk_ano_letivo_ano  CHECK (((ano >= 2000) AND (ano <= 2100)));
ALTER TABLE ONLY public.anos_letivos ADD CONSTRAINT chk_ano_letivo_datas  CHECK ((data_fim >= data_inicio));
ALTER TABLE ONLY public.atribuicoes_professores ADD CONSTRAINT chk_atribuicao_datas  CHECK (((data_fim IS NULL) OR (data_fim >= data_inicio)));
ALTER TABLE ONLY public.atribuicoes_professores ADD CONSTRAINT chk_atribuicoes_papel_catalogo  CHECK (public.fn_chave_catalogo_valida('papel_atribuicao'::text, papel));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_bonus_presenca  CHECK (((bonus_presenca_confirmada >= (0)::numeric) AND (bonus_presenca_confirmada <= (30)::numeric)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_decaimento_tipo  CHECK ((decaimento_ocorrencia_tipo = ANY (ARRAY['nenhum'::text, 'janela'::text, 'exponencial'::text])));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_janela_ocorrencia  CHECK (((janela_ocorrencia_dias >= 30) AND (janela_ocorrencia_dias <= 365)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_janela_positivo  CHECK (((janela_positivo_dias >= 7) AND (janela_positivo_dias <= 90)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_janela_recencia  CHECK (((janela_recencia_dias >= 7) AND (janela_recencia_dias <= 30)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_limite_alto  CHECK (((limite_score_alto >= 60) AND (limite_score_alto <= 90)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_limite_medio  CHECK (((limite_score_medio >= 20) AND (limite_score_medio <= 60)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_limites_score_ordem  CHECK ((limite_score_medio < limite_score_alto));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_falta  CHECK (((peso_falta >= 0.5) AND (peso_falta <= 2.0)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_ocorrencia  CHECK (((peso_ocorrencia >= 0.5) AND (peso_ocorrencia <= 2.0)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_ocorrencia_grave  CHECK (((peso_ocorrencia_grave >= (5)::numeric) AND (peso_ocorrencia_grave <= (30)::numeric)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_positivo  CHECK (((peso_comportamento_positivo >= (0)::numeric) AND (peso_comportamento_positivo <= (15)::numeric)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_recencia  CHECK (((peso_recencia >= (0)::numeric) AND (peso_recencia <= 2.0)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_peso_resolvida  CHECK (((peso_resolvida >= (0)::numeric) AND (peso_resolvida <= (1)::numeric)));
ALTER TABLE ONLY public.configuracoes_sistema ADD CONSTRAINT chk_sistema_singleton  CHECK ((id = 1));
ALTER TABLE ONLY public.convites ADD CONSTRAINT chk_convite_status  CHECK ((status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'expirado'::text, 'revogado'::text])));
ALTER TABLE ONLY public.disciplinas ADD CONSTRAINT chk_disciplina_carga  CHECK ((carga_horaria > 0));
ALTER TABLE ONLY public.enturmacoes ADD CONSTRAINT chk_enturmacao_datas  CHECK (((data_encerramento IS NULL) OR (data_encerramento >= data_matricula)));
ALTER TABLE ONLY public.enturmacoes ADD CONSTRAINT chk_enturmacao_status  CHECK ((status = ANY (ARRAY['matriculado'::text, 'transferido'::text, 'egresso'::text, 'remanejado'::text])));
ALTER TABLE ONLY public.exportacoes ADD CONSTRAINT chk_exportacao_formato  CHECK ((formato = ANY (ARRAY['csv'::text, 'json'::text])));
ALTER TABLE ONLY public.exportacoes ADD CONSTRAINT chk_periodo_exportacao  CHECK ((periodo_fim >= periodo_inicio));
ALTER TABLE ONLY public.frequencias ADD CONSTRAINT chk_frequencias_motivos_catalogo  CHECK (public.fn_chaves_catalogo_validas('motivo_ausencia'::text, motivos_ausencia));
ALTER TABLE ONLY public.frequencias ADD CONSTRAINT chk_frequencias_periodo_catalogo  CHECK (public.fn_chave_catalogo_valida('periodo'::text, periodo));
ALTER TABLE ONLY public.horarios_letivos ADD CONSTRAINT chk_horario_dia  CHECK (((dia_semana >= 0) AND (dia_semana <= 6)));
ALTER TABLE ONLY public.horarios_letivos ADD CONSTRAINT chk_horario_valido  CHECK ((hora_fim > hora_inicio));
ALTER TABLE ONLY public.importacoes_log ADD CONSTRAINT chk_importacao_formato  CHECK ((formato = ANY (ARRAY['csv'::text, 'xlsx'::text])));
ALTER TABLE ONLY public.mensagens ADD CONSTRAINT chk_mensagem_nao_vazia  CHECK ((length(TRIM(BOTH FROM conteudo)) > 0));
ALTER TABLE ONLY public.ocorrencias ADD CONSTRAINT chk_ocorrencias_tags_validas  CHECK (public.fn_tags_validas(tags_comportamento));
ALTER TABLE ONLY public.ocorrencias ADD CONSTRAINT chk_ocorrencias_tipo_catalogo  CHECK (public.fn_chaves_catalogo_validas('tipo_ocorrencia'::text, tipo));
ALTER TABLE ONLY public.perfis ADD CONSTRAINT chk_perfis_modulos_catalogo  CHECK (public.fn_chaves_catalogo_validas('modulo'::text, acesso_modulos));
ALTER TABLE ONLY public.turmas ADD CONSTRAINT chk_turma_capacidade  CHECK (((capacidade IS NULL) OR (capacidade > 0)));
ALTER TABLE ONLY public.turmas ADD CONSTRAINT chk_turmas_letra_catalogo  CHECK (public.fn_chave_catalogo_valida('letra_turma'::text, letra));
ALTER TABLE ONLY public.turmas ADD CONSTRAINT chk_turmas_serie_catalogo  CHECK (public.fn_chave_catalogo_valida('serie_turma'::text, serie));
ALTER TABLE ONLY public.vinculos_responsaveis ADD CONSTRAINT chk_vinculos_tipo_relacao_catalogo  CHECK (public.fn_chave_catalogo_valida('tipo_vinculo'::text, tipo_relacao));
