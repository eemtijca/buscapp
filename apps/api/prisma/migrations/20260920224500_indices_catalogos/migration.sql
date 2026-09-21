-- Índices de apoio às contagens de uso dos catálogos e às consultas por arrays.

set local lock_timeout = '5s';

create index "idx_frequencias_periodo" on public."frequencias"("periodo");
create index "idx_frequencias_motivos_gin" on public."frequencias" using gin ("motivos_ausencia");
create index "idx_ocorrencias_tipo_gin" on public."ocorrencias" using gin ("tipo");
create index "idx_perfis_modulos_gin" on public."perfis" using gin ("acesso_modulos");
create index "idx_alunos_documentos_gin" on public."alunos" using gin ("documentos_recebidos");
