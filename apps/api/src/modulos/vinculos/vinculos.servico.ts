import type {
  AtualizarVinculo,
  CriarVinculo,
  ListarVinculos,
  VinculoResponsavel,
} from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { idsDeAlunosVisiveis } from '../../nucleo/autorizacao/escopo.js';
import { comEscopo } from '../../nucleo/banco/cliente.js';
import { ErroHttp, erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  atualizarVinculo,
  buscarVinculo,
  criarVinculo,
  listarVinculos,
} from './vinculos.repositorio.js';

interface VinculoBruto {
  id: string;
  responsavel_id: string;
  aluno_id: string;
  tipo_relacao: string;
  contato_prioritario: boolean;
  ativo: boolean;
  created_at: Date;
  perfis?: { nome: string } | null;
}

export function paraVinculo(vinculo: VinculoBruto): VinculoResponsavel {
  return {
    id: vinculo.id,
    responsavel_id: vinculo.responsavel_id,
    aluno_id: vinculo.aluno_id,
    tipo_relacao: vinculo.tipo_relacao,
    contato_prioritario: vinculo.contato_prioritario,
    ativo: vinculo.ativo,
    created_at: vinculo.created_at.toISOString(),
    responsavel_nome: vinculo.perfis?.nome ?? null,
  };
}

export async function listar(
  usuario: PerfilAutenticado,
  filtros: ListarVinculos,
): Promise<VinculoResponsavel[]> {
  return comEscopo(async () => {
    if (usuario.papel === 'responsavel') {
      if (filtros.responsavel_id && filtros.responsavel_id !== usuario.id) {
        throw erroNaoEncontrado('Vínculo não encontrado.');
      }
      const vinculos = await listarVinculos({ ...filtros, responsavel_id: usuario.id });
      return vinculos.map(paraVinculo);
    }

    if (usuario.papel === 'professor') {
      const alunos = await idsDeAlunosVisiveis(usuario);
      if (filtros.aluno_id && !(alunos ?? []).includes(filtros.aluno_id)) {
        throw erroNaoEncontrado('Vínculo não encontrado.');
      }
      const vinculos = await listarVinculos(
        filtros.aluno_id ? filtros : { ...filtros, aluno_id: undefined },
      );
      const visiveis = vinculos.filter((vinculo) => (alunos ?? []).includes(vinculo.aluno_id));
      return visiveis.map(paraVinculo);
    }

    const vinculos = await listarVinculos(filtros);
    return vinculos.map(paraVinculo);
  });
}

export async function criar(dados: CriarVinculo): Promise<VinculoResponsavel> {
  try {
    return paraVinculo(await criarVinculo(dados));
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'vinculo_duplicado', 'Este responsável já está vinculado ao aluno.');
    }
    if ((erro as { code?: string }).code === 'P2003') {
      throw new ErroHttp(400, 'referencia_invalida', 'Responsável ou aluno inexistente.');
    }
    throw erro;
  }
}

export async function atualizar(id: string, dados: AtualizarVinculo): Promise<VinculoResponsavel> {
  const existente = await buscarVinculo(id);
  if (!existente) throw erroNaoEncontrado('Vínculo não encontrado.');
  return paraVinculo(await atualizarVinculo(id, dados));
}
