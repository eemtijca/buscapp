import type { ListarNotificacoes, Notificacao, TipoNotificacao } from '@buscapp/contratos';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  buscarNotificacaoDoUsuario,
  contarNaoLidas,
  listarNotificacoes,
  marcarNotificacaoComoLida,
  marcarNotificacoesComoLidas,
  marcarNotificacoesDaConversaComoLidas,
  removerNotificacoes,
} from './notificacoes.repositorio.js';

interface NotificacaoBruta {
  id: string;
  destinatario_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string | null;
  metadados: unknown;
  lida: boolean;
  lida_em: Date | null;
  created_at: Date;
}

export function paraNotificacao(notificacao: NotificacaoBruta): Notificacao {
  return {
    id: notificacao.id,
    destinatario_id: notificacao.destinatario_id,
    tipo: notificacao.tipo,
    titulo: notificacao.titulo,
    corpo: notificacao.corpo,
    metadados: notificacao.metadados as Notificacao['metadados'],
    lida: notificacao.lida,
    lida_em: notificacao.lida_em?.toISOString() ?? null,
    created_at: notificacao.created_at.toISOString(),
  };
}

export interface ResultadoListagem {
  notificacoes: Notificacao[];
  nao_lidas: number;
}

/** Avisa somente o destinatário para recarregar a própria lista. */
function publicarAtualizacao(destinatarioId: string): void {
  publicarEvento({ tabela: 'notificacoes', destinatarios: [destinatarioId] });
}

export async function listar(
  destinatarioId: string,
  consulta: ListarNotificacoes,
): Promise<ResultadoListagem> {
  const [notificacoes, nao_lidas] = await Promise.all([
    listarNotificacoes(destinatarioId, consulta),
    contarNaoLidas(destinatarioId),
  ]);
  return { notificacoes: notificacoes.map(paraNotificacao), nao_lidas };
}

export async function marcarLida(destinatarioId: string, id: string): Promise<Notificacao> {
  const existente = await buscarNotificacaoDoUsuario(id, destinatarioId);
  if (!existente) throw erroNaoEncontrado('Notificação não encontrada.');

  const notificacao = paraNotificacao(await marcarNotificacaoComoLida(id));
  publicarAtualizacao(destinatarioId);
  return notificacao;
}

export async function marcarTodas(destinatarioId: string): Promise<{ atualizadas: number }> {
  const atualizadas = await marcarNotificacoesComoLidas(destinatarioId);
  publicarAtualizacao(destinatarioId);
  return { atualizadas };
}

export async function limpar(destinatarioId: string): Promise<{ removidas: number }> {
  const removidas = await removerNotificacoes(destinatarioId);
  publicarAtualizacao(destinatarioId);
  return { removidas };
}

export async function marcarConversa(
  destinatarioId: string,
  conversaId: string,
): Promise<{ atualizadas: number }> {
  const atualizadas = await marcarNotificacoesDaConversaComoLidas(destinatarioId, conversaId);
  publicarAtualizacao(destinatarioId);
  return { atualizadas };
}
