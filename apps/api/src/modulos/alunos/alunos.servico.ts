import type { Aluno, AtualizarAluno, CriarAluno, ListarAlunos } from '@buscapp/contratos';
import type { PerfilAutenticado } from '../../nucleo/autenticacao/tipos.js';
import { filtroAlunosVisiveis, podeVerAluno } from '../../nucleo/autorizacao/escopo.js';
import { comEscopo } from '../../nucleo/banco/cliente.js';
import { publicarEvento } from '../../nucleo/eventos/barramento.js';
import { auditar } from '../../nucleo/auditoria/registrar.js';
import { ErroHttp, erroNaoEncontrado } from '../../nucleo/http/erros.js';
import {
  atualizarAluno,
  buscarAlunoPorId,
  criarAluno,
  listarAlunos,
} from './alunos.repositorio.js';

interface AlunoBruto {
  id: string;
  nome: string;
  matricula: string;
  codigo_inep: string | null;
  status: 'ativo' | 'egresso' | 'transferido' | 'inativo';
  observacoes: string | null;
  data_nascimento: Date | null;
  data_matricula: Date | null;
  transporte_escolar: boolean;
  alimentacao_diferenciada: boolean;
  necessidades_especiais: boolean;
  documentos_recebidos: string[];
  created_at: Date;
  updated_at: Date;
}

function dataOuNulo(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
}

export function paraAluno(aluno: AlunoBruto): Aluno {
  return {
    id: aluno.id,
    nome: aluno.nome,
    matricula: aluno.matricula,
    codigo_inep: aluno.codigo_inep,
    status: aluno.status,
    observacoes: aluno.observacoes,
    data_nascimento: dataOuNulo(aluno.data_nascimento),
    data_matricula: dataOuNulo(aluno.data_matricula),
    transporte_escolar: aluno.transporte_escolar,
    alimentacao_diferenciada: aluno.alimentacao_diferenciada,
    necessidades_especiais: aluno.necessidades_especiais,
    documentos_recebidos: aluno.documentos_recebidos,
    created_at: aluno.created_at.toISOString(),
    updated_at: aluno.updated_at.toISOString(),
  };
}

export async function listar(usuario: PerfilAutenticado, consulta: ListarAlunos): Promise<Aluno[]> {
  // Escopo + listagem em uma transação: uma única ida ao banco por requisição.
  return comEscopo(async () => {
    const filtro = await filtroAlunosVisiveis(usuario);
    const alunos = await listarAlunos(filtro, consulta);
    return alunos.map(paraAluno);
  });
}

export async function obter(usuario: PerfilAutenticado, id: string): Promise<Aluno> {
  const aluno = await buscarAlunoPorId(id);
  if (!aluno || !(await podeVerAluno(usuario, id))) {
    // Fora do escopo responde 404 para não revelar a existência do registro.
    throw erroNaoEncontrado('Aluno não encontrado.');
  }
  return paraAluno(aluno);
}

export async function criar(dados: CriarAluno, criadoPor: string): Promise<Aluno> {
  try {
    const aluno = await criarAluno(dados);
    publicarEvento({ tabela: 'alunos' });
    await auditar({
      usuarioId: criadoPor,
      acao: 'CRIAR_ALUNO',
      entidade: 'alunos',
      entidadeId: aluno.id,
      dadosNovos: { nome: aluno.nome, matricula: aluno.matricula, status: aluno.status },
    });
    return paraAluno(aluno);
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'matricula_duplicada', 'Já existe um aluno com esta matrícula.');
    }
    throw erro;
  }
}

export async function atualizar(
  id: string,
  dados: AtualizarAluno,
  atualizadoPor: string,
): Promise<Aluno> {
  const existente = await buscarAlunoPorId(id);
  if (!existente) throw erroNaoEncontrado('Aluno não encontrado.');

  try {
    const aluno = await atualizarAluno(id, dados);
    publicarEvento({ tabela: 'alunos' });
    await auditar({
      usuarioId: atualizadoPor,
      acao: 'ATUALIZAR_ALUNO',
      entidade: 'alunos',
      entidadeId: id,
      dadosAnteriores: { nome: existente.nome, status: existente.status },
      dadosNovos: dados,
    });
    return paraAluno(aluno);
  } catch (erro) {
    if ((erro as { code?: string }).code === 'P2002') {
      throw new ErroHttp(409, 'matricula_duplicada', 'Já existe um aluno com esta matrícula.');
    }
    throw erro;
  }
}
