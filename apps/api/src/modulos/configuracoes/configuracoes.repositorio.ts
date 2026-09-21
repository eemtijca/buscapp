import type {
  AtualizarConfiguracaoSistema,
  AtualizarOpcaoConfiguracao,
  AtualizarTagComportamento,
  CriarOpcaoConfiguracao,
  CriarTagComportamento,
  ListarOpcoesConfiguracao,
  ListarTagsComportamento,
} from '@buscapp/contratos';
import { comEscopo, prisma } from '../../nucleo/banco/cliente.js';

export async function garantirConfiguracao() {
  return prisma.configuracoes_sistema.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function atualizarConfiguracao(dados: AtualizarConfiguracaoSistema) {
  const campos = {
    ...(dados.escola_nome !== undefined ? { escola_nome: dados.escola_nome } : {}),
    ...(dados.limite_critico_faltas !== undefined
      ? { limite_critico_faltas: dados.limite_critico_faltas }
      : {}),
    ...(dados.limite_preventivo_faltas !== undefined
      ? { limite_preventivo_faltas: dados.limite_preventivo_faltas }
      : {}),
    ...(dados.dias_expurgo_anexos !== undefined
      ? { dias_expurgo_anexos: dados.dias_expurgo_anexos }
      : {}),
    ...(dados.mensagem_fora_horario !== undefined
      ? { mensagem_fora_horario: dados.mensagem_fora_horario }
      : {}),
    ...(dados.minutos_validade_codigo !== undefined
      ? { minutos_validade_codigo: dados.minutos_validade_codigo }
      : {}),
    ...(dados.max_tentativas_codigo !== undefined
      ? { max_tentativas_codigo: dados.max_tentativas_codigo }
      : {}),
    ...(dados.minutos_bloqueio_codigo !== undefined
      ? { minutos_bloqueio_codigo: dados.minutos_bloqueio_codigo }
      : {}),
    ...(dados.dias_retencao_codigos !== undefined
      ? { dias_retencao_codigos: dados.dias_retencao_codigos }
      : {}),
    ...(dados.peso_falta !== undefined ? { peso_falta: dados.peso_falta } : {}),
    ...(dados.peso_ocorrencia !== undefined ? { peso_ocorrencia: dados.peso_ocorrencia } : {}),
    ...(dados.peso_recencia !== undefined ? { peso_recencia: dados.peso_recencia } : {}),
    ...(dados.janela_recencia_dias !== undefined
      ? { janela_recencia_dias: dados.janela_recencia_dias }
      : {}),
    ...(dados.limite_score_medio !== undefined
      ? { limite_score_medio: dados.limite_score_medio }
      : {}),
    ...(dados.limite_score_alto !== undefined
      ? { limite_score_alto: dados.limite_score_alto }
      : {}),
    ...(dados.peso_ocorrencia_grave !== undefined
      ? { peso_ocorrencia_grave: dados.peso_ocorrencia_grave }
      : {}),
    ...(dados.forcar_medio_em_grave !== undefined
      ? { forcar_medio_em_grave: dados.forcar_medio_em_grave }
      : {}),
    ...(dados.janela_ocorrencia_dias !== undefined
      ? { janela_ocorrencia_dias: dados.janela_ocorrencia_dias }
      : {}),
    ...(dados.decaimento_ocorrencia_tipo !== undefined
      ? { decaimento_ocorrencia_tipo: dados.decaimento_ocorrencia_tipo }
      : {}),
    ...(dados.peso_resolvida !== undefined ? { peso_resolvida: dados.peso_resolvida } : {}),
    ...(dados.peso_comportamento_positivo !== undefined
      ? { peso_comportamento_positivo: dados.peso_comportamento_positivo }
      : {}),
    ...(dados.janela_positivo_dias !== undefined
      ? { janela_positivo_dias: dados.janela_positivo_dias }
      : {}),
    ...(dados.bonus_presenca_confirmada !== undefined
      ? { bonus_presenca_confirmada: dados.bonus_presenca_confirmada }
      : {}),
    updated_at: new Date(),
  };

  return prisma.configuracoes_sistema.upsert({
    where: { id: 1 },
    update: campos,
    create: { id: 1, ...campos },
  });
}

export async function listarOpcoes(consulta: ListarOpcoesConfiguracao) {
  const ativo = consulta.ativo === undefined ? undefined : consulta.ativo === 'true';
  return prisma.opcoes_configuracao.findMany({
    where: {
      ...(consulta.tipo ? { tipo: consulta.tipo } : {}),
      ...(ativo !== undefined ? { ativo } : {}),
    },
    orderBy: [{ ordem: 'asc' }, { created_at: 'asc' }],
    take: consulta.limite,
    skip: consulta.offset,
  });
}

export async function buscarOpcaoPorId(id: string) {
  return prisma.opcoes_configuracao.findUnique({ where: { id } });
}

export async function buscarOpcoesPorIds(ids: string[]) {
  return prisma.opcoes_configuracao.findMany({ where: { id: { in: ids } } });
}

export async function criarOpcao(dados: CriarOpcaoConfiguracao) {
  return prisma.opcoes_configuracao.create({
    data: {
      tipo: dados.tipo,
      chave: dados.chave,
      rotulo: dados.rotulo,
      icone: dados.icone ?? null,
      ordem: dados.ordem ?? 0,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarOpcao(id: string, dados: AtualizarOpcaoConfiguracao) {
  return prisma.opcoes_configuracao.update({
    where: { id },
    data: {
      ...(dados.rotulo !== undefined ? { rotulo: dados.rotulo } : {}),
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
      ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      updated_at: new Date(),
    },
  });
}

export async function reordenarOpcoes(itens: Array<{ id: string; ordem: number }>) {
  return comEscopo(async (tx) => {
    const atualizadas = [];
    for (const item of itens) {
      atualizadas.push(
        await tx.opcoes_configuracao.update({
          where: { id: item.id },
          data: { ordem: item.ordem, updated_at: new Date() },
        }),
      );
    }
    return atualizadas;
  });
}

export async function excluirOpcao(id: string) {
  return prisma.opcoes_configuracao.delete({ where: { id } });
}

/**
 * Conta referências à chave de uma opção nas tabelas que usam o catálogo.
 * O mapeamento espelha `apps/web/src/utils/opcoesConfiguracao.ts`.
 */
export async function contarUsosOpcao(tipo: string, chave: string): Promise<number> {
  switch (tipo) {
    case 'modulo':
      return prisma.perfis.count({ where: { acesso_modulos: { has: chave } } });
    case 'documento':
      return prisma.alunos.count({ where: { documentos_recebidos: { has: chave } } });
    case 'periodo':
      return prisma.frequencias.count({ where: { periodo: chave } });
    case 'motivo_ausencia':
      return prisma.frequencias.count({ where: { motivos_ausencia: { has: chave } } });
    case 'tipo_ocorrencia':
      return prisma.ocorrencias.count({ where: { tipo: { has: chave } } });
    case 'tipo_vinculo':
      return prisma.vinculos_responsaveis.count({ where: { tipo_relacao: chave } });
    case 'papel_atribuicao':
      return prisma.atribuicoes_professores.count({ where: { papel: chave } });
    case 'serie_turma':
      return prisma.turmas.count({ where: { serie: chave } });
    case 'letra_turma':
      return prisma.turmas.count({ where: { letra: chave } });
    default:
      return 0;
  }
}

export async function listarHorarios() {
  return prisma.horarios_letivos.findMany({
    orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
  });
}

export async function buscarHorarioPorId(id: string) {
  return prisma.horarios_letivos.findUnique({ where: { id } });
}

export interface DadosHorarioLetivo {
  dia_semana: number;
  hora_inicio: Date;
  hora_fim: Date;
  ativo?: boolean;
}

export async function criarHorario(dados: DadosHorarioLetivo) {
  return prisma.horarios_letivos.create({
    data: {
      dia_semana: dados.dia_semana,
      hora_inicio: dados.hora_inicio,
      hora_fim: dados.hora_fim,
      ativo: dados.ativo ?? true,
    },
  });
}

export interface DadosAtualizacaoHorario {
  dia_semana?: number;
  hora_inicio?: Date;
  hora_fim?: Date;
  ativo?: boolean;
}

export async function atualizarHorario(id: string, dados: DadosAtualizacaoHorario) {
  return prisma.horarios_letivos.update({
    where: { id },
    data: {
      ...(dados.dia_semana !== undefined ? { dia_semana: dados.dia_semana } : {}),
      ...(dados.hora_inicio !== undefined ? { hora_inicio: dados.hora_inicio } : {}),
      ...(dados.hora_fim !== undefined ? { hora_fim: dados.hora_fim } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      updated_at: new Date(),
    },
  });
}

export async function excluirHorario(id: string) {
  return prisma.horarios_letivos.delete({ where: { id } });
}

export async function listarTags(consulta: ListarTagsComportamento) {
  const ativo = consulta.ativo === undefined ? undefined : consulta.ativo === 'true';
  return prisma.tags_comportamento.findMany({
    where: ativo !== undefined ? { ativo } : {},
    orderBy: { nome: 'asc' },
    take: consulta.limite,
    skip: consulta.offset,
  });
}

export async function buscarTagPorId(id: string) {
  return prisma.tags_comportamento.findUnique({ where: { id } });
}

export async function criarTag(dados: CriarTagComportamento) {
  return prisma.tags_comportamento.create({
    data: {
      nome: dados.nome,
      categoria: dados.categoria,
      icone: dados.icone ?? null,
      descricao: dados.descricao ?? null,
      peso_pontuacao: dados.peso_pontuacao ?? 0,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarTag(id: string, dados: AtualizarTagComportamento) {
  return prisma.tags_comportamento.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.categoria !== undefined ? { categoria: dados.categoria } : {}),
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
      ...(dados.peso_pontuacao !== undefined ? { peso_pontuacao: dados.peso_pontuacao } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      updated_at: new Date(),
    },
  });
}

export async function excluirTag(id: string) {
  return prisma.tags_comportamento.delete({ where: { id } });
}

/** Conta referências à tag em ocorrências (nome) e registros de comportamento (id). */
export async function contarUsosTag(id: string, nome: string): Promise<number> {
  const [emOcorrencias, emRegistros] = await Promise.all([
    prisma.ocorrencias.count({ where: { tags_comportamento: { has: nome } } }),
    prisma.registro_comportamento_tags.count({ where: { tag_id: id } }),
  ]);
  return emOcorrencias + emRegistros;
}
