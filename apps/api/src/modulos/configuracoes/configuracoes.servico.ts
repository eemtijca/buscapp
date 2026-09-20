import type {
  AtualizarConfiguracaoSistema,
  AtualizarHorarioLetivo,
  AtualizarOpcaoConfiguracao,
  AtualizarTagComportamento,
  ConfiguracaoSistema,
  CriarHorarioLetivo,
  CriarOpcaoConfiguracao,
  CriarTagComportamento,
  HorarioLetivo,
  ListarOpcoesConfiguracao,
  ListarTagsComportamento,
  OpcaoConfiguracao,
  ReordenarOpcoesConfiguracao,
  TagComportamentoCatalogo,
} from '@buscapp/contratos';
import type {
  configuracoes_sistema,
  horarios_letivos,
  opcoes_configuracao,
  tags_comportamento,
} from '../../../generated/prisma/client.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { ambiente } from '../../ambiente.js';
import { ErroHttp, erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  atualizarConfiguracao,
  atualizarHorario,
  atualizarOpcao,
  atualizarTag,
  buscarHorarioPorId,
  buscarOpcaoPorId,
  buscarOpcoesPorIds,
  buscarTagPorId,
  contarUsosOpcao,
  contarUsosTag,
  criarHorario,
  criarOpcao,
  criarTag,
  excluirHorario,
  excluirOpcao,
  excluirTag,
  garantirConfiguracao,
  listarHorarios,
  listarOpcoes,
  listarTags,
  reordenarOpcoes,
} from './configuracoes.repositorio.js';

const USO_NAO_IDENTIFICADO = new ErroHttp(
  409,
  'registro_em_uso',
  'Não é possível excluir: o registro está em uso. Desative-o para deixá-lo indisponível.',
);

function numero(valor: unknown): number {
  return valor === null || valor === undefined ? 0 : Number(valor);
}

export function paraConfiguracao(row: configuracoes_sistema): ConfiguracaoSistema {
  return {
    id: row.id,
    escola_nome: row.escola_nome,
    limite_critico_faltas: row.limite_critico_faltas,
    limite_preventivo_faltas: row.limite_preventivo_faltas,
    dias_expurgo_anexos: row.dias_expurgo_anexos,
    mensagem_fora_horario: row.mensagem_fora_horario,
    minutos_validade_codigo: row.minutos_validade_codigo,
    max_tentativas_codigo: row.max_tentativas_codigo,
    minutos_bloqueio_codigo: row.minutos_bloqueio_codigo,
    dias_retencao_codigos: row.dias_retencao_codigos,
    peso_falta: numero(row.peso_falta),
    peso_ocorrencia: numero(row.peso_ocorrencia),
    peso_recencia: numero(row.peso_recencia),
    janela_recencia_dias: row.janela_recencia_dias,
    limite_score_medio: row.limite_score_medio,
    limite_score_alto: row.limite_score_alto,
    peso_ocorrencia_grave: numero(row.peso_ocorrencia_grave),
    forcar_medio_em_grave: row.forcar_medio_em_grave,
    janela_ocorrencia_dias: row.janela_ocorrencia_dias,
    decaimento_ocorrencia_tipo:
      row.decaimento_ocorrencia_tipo as ConfiguracaoSistema['decaimento_ocorrencia_tipo'],
    peso_resolvida: numero(row.peso_resolvida),
    peso_comportamento_positivo: numero(row.peso_comportamento_positivo),
    janela_positivo_dias: row.janela_positivo_dias,
    bonus_presenca_confirmada: numero(row.bonus_presenca_confirmada),
    updated_at: row.updated_at.toISOString(),
    fuso_horario: ambiente.TZ_ESCOLA,
  };
}

export function paraOpcao(row: opcoes_configuracao): OpcaoConfiguracao {
  return {
    id: row.id,
    tipo: row.tipo,
    chave: row.chave,
    rotulo: row.rotulo,
    icone: row.icone,
    ordem: row.ordem,
    ativo: row.ativo,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function paraHora(data: Date): string {
  return data.toISOString().slice(11, 19);
}

function minutosDaHora(hora: string): number {
  const [horas = '0', minutos = '0'] = hora.split(':');
  return Number(horas) * 60 + Number(minutos);
}

function validarIntervalo(horaInicio: string, horaFim: string): void {
  if (minutosDaHora(horaFim) <= minutosDaHora(horaInicio)) {
    throw new ErroHttp(
      400,
      'horario_invalido',
      'O horário de fim deve ser posterior ao de início.',
    );
  }
}

function paraDataHora(hora: string): Date {
  const normalizada = hora.length === 5 ? `${hora}:00` : hora;
  return new Date(`1970-01-01T${normalizada}.000Z`);
}

export function paraHorario(row: horarios_letivos): HorarioLetivo {
  return {
    id: row.id,
    dia_semana: row.dia_semana,
    hora_inicio: paraHora(row.hora_inicio),
    hora_fim: paraHora(row.hora_fim),
    ativo: row.ativo,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function paraTag(row: tags_comportamento): TagComportamentoCatalogo {
  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    icone: row.icone,
    descricao: row.descricao,
    peso_pontuacao: row.peso_pontuacao,
    ativo: row.ativo,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function codigoPostgres(erro: unknown): string | undefined {
  const tipado = erro as { code?: string; cause?: { code?: string } };
  return tipado.cause?.code ?? tipado.code;
}

function mensagemBanco(erro: unknown): string {
  return (erro as { message?: string }).message ?? '';
}

function traduzirErroOpcao(erro: unknown): never {
  if (codigoPostgres(erro) === 'P2002') {
    throw new ErroHttp(
      409,
      'chave_duplicada',
      'Já existe uma opção com esta chave para este tipo.',
    );
  }
  const mensagem = mensagemBanco(erro);
  if (
    codigoPostgres(erro) === '23514' ||
    codigoPostgres(erro) === '23503' ||
    mensagem.includes('chk_') ||
    mensagem.includes('catalogo')
  ) {
    throw USO_NAO_IDENTIFICADO;
  }
  throw erro;
}

function traduzirErroTag(erro: unknown): never {
  if (codigoPostgres(erro) === 'P2002') {
    throw new ErroHttp(409, 'nome_duplicado', 'Já existe uma tag com este nome.');
  }
  const mensagem = mensagemBanco(erro);
  if (
    codigoPostgres(erro) === '23503' ||
    codigoPostgres(erro) === '23514' ||
    mensagem.includes('tag_id_fkey') ||
    mensagem.includes('ocorrencias_tags_validas')
  ) {
    throw new ErroHttp(
      409,
      'tag_em_uso',
      'Não é possível excluir: a tag está vinculada a ocorrências ou registros de comportamento. Desative-a para deixá-la indisponível.',
    );
  }
  throw erro;
}

export async function obterConfiguracao(): Promise<ConfiguracaoSistema> {
  const configuracao = await garantirConfiguracao();
  return paraConfiguracao(configuracao);
}

export async function atualizarConfiguracaoSistema(
  dados: AtualizarConfiguracaoSistema,
): Promise<ConfiguracaoSistema> {
  const atualizada = await atualizarConfiguracao(dados);
  publicarEvento({ tabela: 'configuracoes_sistema' });
  return paraConfiguracao(atualizada);
}

export async function listarOpcoesConfiguracao(
  consulta: ListarOpcoesConfiguracao,
): Promise<OpcaoConfiguracao[]> {
  return (await listarOpcoes(consulta)).map(paraOpcao);
}

export async function criarOpcaoConfiguracao(
  dados: CriarOpcaoConfiguracao,
): Promise<OpcaoConfiguracao> {
  try {
    const criada = await criarOpcao(dados);
    publicarEvento({ tabela: 'opcoes_configuracao' });
    return paraOpcao(criada);
  } catch (erro) {
    traduzirErroOpcao(erro);
  }
}

export async function atualizarOpcaoConfiguracao(
  id: string,
  dados: AtualizarOpcaoConfiguracao,
): Promise<OpcaoConfiguracao> {
  const existente = await buscarOpcaoPorId(id);
  if (!existente) throw erroNaoEncontrado('Opção não encontrada.');

  try {
    const atualizada = await atualizarOpcao(id, dados);
    publicarEvento({ tabela: 'opcoes_configuracao' });
    return paraOpcao(atualizada);
  } catch (erro) {
    traduzirErroOpcao(erro);
  }
}

export async function reordenarOpcoesConfiguracao(
  dados: ReordenarOpcoesConfiguracao,
): Promise<OpcaoConfiguracao[]> {
  const ids = [...new Set(dados.itens.map((item) => item.id))];
  const existentes = await buscarOpcoesPorIds(ids);
  if (existentes.length !== ids.length) throw erroNaoEncontrado('Opção não encontrada.');

  const atualizadas = await reordenarOpcoes(dados.itens);
  publicarEvento({ tabela: 'opcoes_configuracao' });
  return atualizadas.map(paraOpcao);
}

export async function excluirOpcaoConfiguracao(id: string): Promise<void> {
  const existente = await buscarOpcaoPorId(id);
  if (!existente) throw erroNaoEncontrado('Opção não encontrada.');

  const usos = await contarUsosOpcao(existente.tipo, existente.chave);
  if (usos > 0) {
    throw new ErroHttp(
      409,
      'opcao_em_uso',
      `Não é possível excluir "${existente.rotulo}": está referenciada por ${usos} registro(s). Desative-a para deixá-la indisponível.`,
    );
  }

  try {
    await excluirOpcao(id);
    publicarEvento({ tabela: 'opcoes_configuracao' });
  } catch (erro) {
    traduzirErroOpcao(erro);
  }
}

export async function listarHorariosLetivos(): Promise<HorarioLetivo[]> {
  return (await listarHorarios()).map(paraHorario);
}

export async function criarHorarioLetivo(dados: CriarHorarioLetivo): Promise<HorarioLetivo> {
  validarIntervalo(dados.hora_inicio, dados.hora_fim);
  let criado;
  try {
    criado = await criarHorario({
      dia_semana: dados.dia_semana,
      hora_inicio: paraDataHora(dados.hora_inicio),
      hora_fim: paraDataHora(dados.hora_fim),
      ativo: dados.ativo,
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'horario_duplicado', 'Já existe um horário com este dia e intervalo.');
    }
    throw erro;
  }
  publicarEvento({ tabela: 'horarios_letivos' });
  return paraHorario(criado);
}

export async function atualizarHorarioLetivo(
  id: string,
  dados: AtualizarHorarioLetivo,
): Promise<HorarioLetivo> {
  const existente = await buscarHorarioPorId(id);
  if (!existente) throw erroNaoEncontrado('Horário não encontrado.');

  const horaInicio = dados.hora_inicio ?? paraHora(existente.hora_inicio);
  const horaFim = dados.hora_fim ?? paraHora(existente.hora_fim);
  validarIntervalo(horaInicio, horaFim);

  let atualizado;
  try {
    atualizado = await atualizarHorario(id, {
      ...(dados.dia_semana !== undefined ? { dia_semana: dados.dia_semana } : {}),
      ...(dados.hora_inicio !== undefined ? { hora_inicio: paraDataHora(dados.hora_inicio) } : {}),
      ...(dados.hora_fim !== undefined ? { hora_fim: paraDataHora(dados.hora_fim) } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'horario_duplicado', 'Já existe um horário com este dia e intervalo.');
    }
    throw erro;
  }
  publicarEvento({ tabela: 'horarios_letivos' });
  return paraHorario(atualizado);
}

export async function atualizarStatusHorarioLetivo(
  id: string,
  ativo: boolean,
): Promise<HorarioLetivo> {
  const existente = await buscarHorarioPorId(id);
  if (!existente) throw erroNaoEncontrado('Horário não encontrado.');

  const atualizado = await atualizarHorario(id, { ativo });
  publicarEvento({ tabela: 'horarios_letivos' });
  return paraHorario(atualizado);
}

export async function excluirHorarioLetivo(id: string): Promise<void> {
  const existente = await buscarHorarioPorId(id);
  if (!existente) throw erroNaoEncontrado('Horário não encontrado.');
  await excluirHorario(id);
  publicarEvento({ tabela: 'horarios_letivos' });
}

export async function listarTagsComportamento(
  consulta: ListarTagsComportamento,
): Promise<TagComportamentoCatalogo[]> {
  return (await listarTags(consulta)).map(paraTag);
}

export async function criarTagComportamento(
  dados: CriarTagComportamento,
): Promise<TagComportamentoCatalogo> {
  try {
    const criada = await criarTag(dados);
    publicarEvento({ tabela: 'tags_comportamento' });
    return paraTag(criada);
  } catch (erro) {
    traduzirErroTag(erro);
  }
}

export async function atualizarTagComportamento(
  id: string,
  dados: AtualizarTagComportamento,
): Promise<TagComportamentoCatalogo> {
  const existente = await buscarTagPorId(id);
  if (!existente) throw erroNaoEncontrado('Tag não encontrada.');

  if (dados.nome !== undefined && dados.nome !== existente.nome) {
    const usos = await contarUsosTag(id, existente.nome);
    if (usos > 0) {
      throw new ErroHttp(
        409,
        'tag_em_uso',
        `Não é possível renomear: a tag é usada em ${usos} referência(s). Desative-a em vez de renomear.`,
      );
    }
  }

  try {
    const atualizada = await atualizarTag(id, dados);
    publicarEvento({ tabela: 'tags_comportamento' });
    return paraTag(atualizada);
  } catch (erro) {
    traduzirErroTag(erro);
  }
}

export async function atualizarStatusTagComportamento(
  id: string,
  ativo: boolean,
): Promise<TagComportamentoCatalogo> {
  const existente = await buscarTagPorId(id);
  if (!existente) throw erroNaoEncontrado('Tag não encontrada.');

  const atualizada = await atualizarTag(id, { ativo });
  publicarEvento({ tabela: 'tags_comportamento' });
  return paraTag(atualizada);
}

export async function excluirTagComportamento(id: string): Promise<void> {
  const existente = await buscarTagPorId(id);
  if (!existente) throw erroNaoEncontrado('Tag não encontrada.');

  const usos = await contarUsosTag(id, existente.nome);
  if (usos > 0) {
    throw new ErroHttp(
      409,
      'tag_em_uso',
      `Não é possível excluir: a tag é usada em ${usos} referência(s). Desative-a para deixá-la indisponível.`,
    );
  }

  try {
    await excluirTag(id);
    publicarEvento({ tabela: 'tags_comportamento' });
  } catch (erro) {
    traduzirErroTag(erro);
  }
}
