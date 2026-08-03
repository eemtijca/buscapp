// ============================================================================
// Catálogo de regras por tipo de opção de configuração.
// Centraliza rótulo, placeholder, ícone, regra de entrada e verificação de uso
// para a interface genérica de opções (GestaoConfiguracaoOpcoesView.vue).
// ============================================================================

export type TipoCampo = 'texto' | 'letra' | 'ordinal';

export interface RegraUso {
  tabela: string;
  coluna: string;
  isArray: boolean;
}

export interface RegraCampo {
  titulo: string;
  rotulo: string;
  placeholder: string;
  icone: string;
  campo: TipoCampo;
  minlength: number;
  maxlength: number;
  filtrar?: (v: string) => string;
  transformar?: (v: string) => string;
  padrao?: RegExp;
  mensagemPadrao?: string;
  verificarUso: RegraUso[];
}

function normalizarTexto(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
}

const regraTexto = (
  maxlength: number,
  minlength = 2,
): Pick<RegraCampo, 'campo' | 'minlength' | 'maxlength' | 'transformar'> => ({
  campo: 'texto',
  minlength,
  maxlength,
  transformar: normalizarTexto,
});

export const REGRA_TIPOS: Record<string, RegraCampo> = {
  modulo: {
    titulo: 'Módulos',
    rotulo: 'Nome',
    placeholder: 'ex.: Frequência',
    icone: 'ui-checks',
    ...regraTexto(40, 3),
    verificarUso: [{ tabela: 'perfis', coluna: 'acesso_modulos', isArray: true }],
  },
  documento: {
    titulo: 'Documentos',
    rotulo: 'Nome',
    placeholder: 'ex.: Certidão de Nascimento',
    icone: 'file-earmark-text',
    ...regraTexto(60),
    verificarUso: [{ tabela: 'alunos', coluna: 'documentos_recebidos', isArray: true }],
  },
  periodo: {
    titulo: 'Períodos',
    rotulo: 'Nome',
    placeholder: 'ex.: Manhã',
    icone: 'clock',
    ...regraTexto(40),
    verificarUso: [{ tabela: 'frequencias', coluna: 'periodo', isArray: false }],
  },
  motivo_ausencia: {
    titulo: 'Motivos de Ausência',
    rotulo: 'Nome',
    placeholder: 'ex.: Doença',
    icone: 'heart-pulse',
    ...regraTexto(60),
    verificarUso: [{ tabela: 'frequencias', coluna: 'motivos_ausencia', isArray: true }],
  },
  tipo_ocorrencia: {
    titulo: 'Tipos de Ocorrência',
    rotulo: 'Nome',
    placeholder: 'ex.: Atraso',
    icone: 'exclamation-triangle',
    ...regraTexto(60),
    verificarUso: [{ tabela: 'ocorrencias', coluna: 'tipo', isArray: true }],
  },
  tipo_vinculo: {
    titulo: 'Vínculos',
    rotulo: 'Nome',
    placeholder: 'ex.: Pai',
    icone: 'people',
    ...regraTexto(30),
    verificarUso: [{ tabela: 'vinculos_responsaveis', coluna: 'tipo_relacao', isArray: false }],
  },
  papel_atribuicao: {
    titulo: 'Papéis de Atribuição',
    rotulo: 'Nome',
    placeholder: 'ex.: Titular',
    icone: 'person-badge',
    ...regraTexto(30),
    verificarUso: [{ tabela: 'atribuicoes_professores', coluna: 'papel', isArray: false }],
  },
  serie_turma: {
    titulo: 'Séries',
    rotulo: 'Série',
    placeholder: 'ex.: 4º',
    icone: 'book',
    campo: 'ordinal',
    minlength: 1,
    maxlength: 2,
    filtrar: (v) => v.replace(/\D/g, '').slice(0, 2),
    transformar: (v) => {
      const digitos = v.replace(/\D/g, '');
      return digitos ? `${digitos}º` : v.trim();
    },
    padrao: /^\d{1,2}º$/,
    mensagemPadrao: 'Digite apenas o número da série (ex.: 4º).',
    verificarUso: [{ tabela: 'turmas', coluna: 'serie', isArray: false }],
  },
  letra_turma: {
    titulo: 'Letras de Turma',
    rotulo: 'Letra',
    placeholder: 'ex.: D',
    icone: 'fonts',
    campo: 'letra',
    minlength: 1,
    maxlength: 1,
    filtrar: (v) => v.replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().slice(0, 1),
    transformar: (v) => v.trim().toUpperCase(),
    padrao: /^[A-ZÀ-Ý]$/,
    mensagemPadrao: 'Digite apenas a letra da turma (ex.: D).',
    verificarUso: [{ tabela: 'turmas', coluna: 'letra', isArray: false }],
  },
};

const REGRA_PADRAO: RegraCampo = {
  titulo: 'Opções',
  rotulo: 'Nome',
  placeholder: 'ex.: Nome',
  icone: 'tag',
  campo: 'texto',
  minlength: 2,
  maxlength: 80,
  transformar: normalizarTexto,
  verificarUso: [],
};

export function obterRegra(tipo: string): RegraCampo {
  return REGRA_TIPOS[tipo] ?? REGRA_PADRAO;
}

export function normalizarChaveTexto(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function gerarChave(nome: string, tipo: string): string {
  switch (tipo) {
    case 'letra_turma':
      return nome.trim().charAt(0).toUpperCase() || 'A';
    case 'serie_turma': {
      const m = nome.trim().match(/^(\d+[ºª]?)/);
      return m ? (m[1] ?? nome.trim()) : nome.trim();
    }
    default:
      return nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .replace(/_+/g, '_');
  }
}
