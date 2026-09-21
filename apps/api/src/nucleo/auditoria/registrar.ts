import { prismaAdmin } from '../banco/cliente.js';

export interface EventoAuditoria {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  ip?: string | null;
}

/**
 * Registra um evento de auditoria. Usa o cliente administrativo porque há eventos
 * em contexto anônimo (login) e a tabela é restrita à gestão pelo RLS.
 * Falha de auditoria não interrompe a operação.
 */
export async function auditar(evento: EventoAuditoria): Promise<void> {
  await prismaAdmin.auditoria
    .create({
      data: {
        usuario_id: evento.usuarioId ?? null,
        acao: evento.acao,
        entidade: evento.entidade,
        entidade_id: evento.entidadeId ?? null,
        dados_anteriores: (evento.dadosAnteriores ?? null) as never,
        dados_novos: (evento.dadosNovos ?? null) as never,
        ip_origem: evento.ip ?? null,
      },
    })
    .catch(() => undefined);
}
