import type { Auditoria, ListarAuditoria } from '@buscapp/contratos';
import { prisma } from '../../nucleo/banco/cliente.js';

interface RegistroAuditoria {
  id: string;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_anteriores: unknown;
  dados_novos: unknown;
  ip_origem: string | null;
  created_at: Date;
  perfis: { nome: string } | null;
}

function paraAuditoria(registro: RegistroAuditoria): Auditoria {
  return {
    id: registro.id,
    usuario_id: registro.usuario_id,
    usuario_nome: registro.perfis?.nome ?? null,
    acao: registro.acao,
    entidade: registro.entidade,
    entidade_id: registro.entidade_id,
    dados_anteriores: registro.dados_anteriores ?? null,
    dados_novos: registro.dados_novos ?? null,
    ip_origem: registro.ip_origem,
    created_at: registro.created_at.toISOString(),
  };
}

/** Lista eventos de auditoria (somente gestão), do mais recente para o mais antigo. */
export async function listar(consulta: ListarAuditoria): Promise<Auditoria[]> {
  const registros = await prisma.auditoria.findMany({
    where: {
      ...(consulta.acao ? { acao: consulta.acao } : {}),
      ...(consulta.entidade ? { entidade: consulta.entidade } : {}),
      ...(consulta.usuario_id ? { usuario_id: consulta.usuario_id } : {}),
      ...(consulta.data_inicio || consulta.data_fim
        ? {
            created_at: {
              ...(consulta.data_inicio
                ? { gte: new Date(`${consulta.data_inicio}T00:00:00.000Z`) }
                : {}),
              ...(consulta.data_fim ? { lte: new Date(`${consulta.data_fim}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: { perfis: { select: { nome: true } } },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: consulta.limite,
    skip: consulta.offset,
  });

  return (registros as RegistroAuditoria[]).map(paraAuditoria);
}
