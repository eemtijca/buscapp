import { consultar } from './cache';
import { Consultas } from './consultas';

type Aquecedor = () => void;

/**
 * Aquece em segundo plano as consultas principais de cada rota.
 * O aquecimento só dispara requisição quando não há dado fresco no cache
 * e é restrito a rotas cujo papel tem acesso aos endpoints.
 */
const AQUECEDORES: Record<string, Aquecedor[]> = {
  '/gestao/ranking': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.frequencias({ status: 'ausente' })),
    () => consultar(Consultas.justificativas({ status: 'aceita' })),
    () => consultar(Consultas.ocorrencias()),
    () => consultar(Consultas.tags()),
  ],
  '/gestao/ocorrencias': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.ocorrencias()),
    () => consultar(Consultas.tags()),
    () => consultar(Consultas.opcoes('tipo_ocorrencia')),
  ],
  '/gestao/justificativas': [() => consultar(Consultas.justificativas())],
  '/gestao/infrequencias': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.enturmacoes({ status: 'matriculado' })),
    () => consultar(Consultas.opcoes('periodo')),
    () => consultar(Consultas.opcoes('motivo_ausencia')),
  ],
  '/gestao/alunos': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.enturmacoes({ status: 'matriculado' })),
  ],
  '/gestao/usuarios': [() => consultar(Consultas.usuarios())],
  '/gestao/turmas': [
    () => consultar(Consultas.turmas()),
    () => consultar(Consultas.anosLetivos()),
    () => consultar(Consultas.opcoes('serie_turma')),
    () => consultar(Consultas.opcoes('letra_turma')),
  ],
  '/gestao/disciplinas': [() => consultar(Consultas.disciplinas())],
  '/gestao/anos-letivos': [() => consultar(Consultas.anosLetivos())],
  '/gestao/atribuicoes': [
    () => consultar(Consultas.atribuicoes()),
    () => consultar(Consultas.turmas({ ativo: 'true' })),
    () => consultar(Consultas.disciplinas({ ativo: 'true' })),
    () => consultar(Consultas.usuarios({ papel: 'professor' })),
    () => consultar(Consultas.opcoes('papel_atribuicao')),
  ],
  '/gestao/codigos': [() => consultar(Consultas.codigos())],
  '/gestao/chat': [() => consultar(Consultas.conversas())],
  '/professor/frequencia': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.enturmacoes({ status: 'matriculado' })),
    () => consultar(Consultas.opcoes('periodo')),
  ],
  '/professor/ausencia': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.opcoes('periodo')),
    () => consultar(Consultas.opcoes('motivo_ausencia')),
  ],
  '/professor/ocorrencia': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.tags()),
    () => consultar(Consultas.opcoes('tipo_ocorrencia')),
  ],
  '/responsavel/alertas': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.justificativas()),
    () => consultar(Consultas.ocorrencias()),
    () => consultar(Consultas.tags()),
  ],
  '/responsavel/termometro': [() => consultar(Consultas.alunos())],
  '/responsavel/justificativa': [() => consultar(Consultas.alunos())],
  '/responsavel/chat': [
    () => consultar(Consultas.alunos()),
    () => consultar(Consultas.conversas()),
  ],
};

/** Aquece as consultas da rota informada; ignora rotas sem aquecedor. */
export function prefetchRota(rota: string): void {
  const aquecedores = AQUECEDORES[rota];
  if (!aquecedores) return;

  for (const aquecer of aquecedores) {
    try {
      aquecer();
    } catch {
      /* aquecimento é best-effort */
    }
  }
}

/** Aquece os dados de referência usados no shell autenticado. */
export function prefetchEssenciais(): void {
  consultar(Consultas.configuracoes());
  consultar(Consultas.tags());
}
