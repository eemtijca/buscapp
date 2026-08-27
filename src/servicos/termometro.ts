import type { NivelRisco } from '@/tipos/componentes';

/** Configuração do termômetro lida de configuracoes_sistema. */
export interface ConfigTermometro {
  preventivo: number;
  critico: number;
  pesoFalta: number;
  pesoOcorrencia: number;
  pesoRecencia: number;
  janelaRecenciaDias: number;
  limiteScoreMedio: number;
  limiteScoreAlto: number;
}

/** Valores padrão quando a configuração ainda não foi carregada. */
export const CONFIG_TERMOMETRO_PADRAO: ConfigTermometro = {
  preventivo: 10,
  critico: 25,
  pesoFalta: 1,
  pesoOcorrencia: 1,
  pesoRecencia: 1,
  janelaRecenciaDias: 14,
  limiteScoreMedio: 40,
  limiteScoreAlto: 75,
};

/** Entrada para o cálculo do termômetro. */
export interface EntradaTermometro {
  faltasInjustificadas: number;
  faltasRecentes: number;
  diasDesdeUltimaFalta: number | null;
  ocorrencias: Array<{
    peso: number;
    exigePresenca: boolean;
    categoria: string;
  }>;
}

/** Resultado do cálculo com fatores explicativos. */
export interface ResultadoTermometro {
  score: number;
  nivel: NivelRisco;
  fatores: string[];
}

/** Calcula o nível de risco a partir do score e das faltas absolutas. */
export function calcularNivel(
  score: number,
  faltasInjustificadas: number,
  ocorrencias: EntradaTermometro['ocorrencias'],
  cfg: ConfigTermometro,
): NivelRisco {
  // Presença obrigatória ou tag crítica força nível alto imediatamente.
  const temGatilhoCritico = ocorrencias.some((o) => o.exigePresenca || o.categoria === 'critico');
  if (temGatilhoCritico) return 'alto';

  // Limite absoluto de faltas tem precedência sobre o score.
  if (faltasInjustificadas >= cfg.critico) return 'alto';
  if (faltasInjustificadas >= cfg.preventivo) return 'medio';

  // Caso contrário, usa os limiares de score configuráveis.
  if (score >= cfg.limiteScoreAlto) return 'alto';
  if (score >= cfg.limiteScoreMedio) return 'medio';
  return 'baixo';
}

/** Calcula o score 0–100 e os fatores explicativos. */
export function calcularTermometro(
  entrada: EntradaTermometro,
  cfg: ConfigTermometro = CONFIG_TERMOMETRO_PADRAO,
): ResultadoTermometro {
  const fatores: string[] = [];

  // Componente de faltas: até 70 pontos, proporcional ao limite crítico.
  const baseFaltas = Math.min(70, (entrada.faltasInjustificadas / Math.max(1, cfg.critico)) * 70);
  const scoreFaltas = Math.min(70, baseFaltas * cfg.pesoFalta);
  if (entrada.faltasInjustificadas > 0) {
    fatores.push(`${entrada.faltasInjustificadas} falta(s) injustificada(s)`);
  }

  // Componente de ocorrências: soma dos pesos das tags, limitado a 30 pontos.
  const somaPesoOcorrencias = entrada.ocorrencias.reduce((acc, o) => acc + Math.max(0, o.peso), 0);
  const baseOcorrencias = Math.min(30, somaPesoOcorrencias);
  const scoreOcorrencias = Math.min(30, baseOcorrencias * cfg.pesoOcorrencia);
  if (entrada.ocorrencias.length > 0) {
    // Se houver pesos configurados, exibe a soma; senão, contagem simples.
    if (somaPesoOcorrencias > 0) {
      fatores.push(`${entrada.ocorrencias.length} ocorrência(s) — peso ${somaPesoOcorrencias}`);
    } else {
      fatores.push(`${entrada.ocorrencias.length} ocorrência(s)`);
    }
  }
  const temExigePresenca = entrada.ocorrencias.some((o) => o.exigePresenca);
  if (temExigePresenca) {
    fatores.push('exige presença do responsável');
  }

  // Componente de recência: faltas recentes + decaimento por dias sem falta.
  let scoreRecencia = 0;
  if (entrada.faltasRecentes > 0) {
    // Até 15 pontos por concentração recente.
    const baseRecencia = Math.min(15, entrada.faltasRecentes * 5);
    scoreRecencia = Math.min(15, baseRecencia * cfg.pesoRecencia);
    fatores.push(`${entrada.faltasRecentes} falta(s) nos últimos ${cfg.janelaRecenciaDias} dias`);
  }
  // Bônus de decaimento: quanto mais recente a última falta, maior o peso.
  if (entrada.diasDesdeUltimaFalta !== null && entrada.diasDesdeUltimaFalta <= 7) {
    const bonusImediato = Math.max(0, 5 - entrada.diasDesdeUltimaFalta) * cfg.pesoRecencia;
    scoreRecencia = Math.min(15, scoreRecencia + bonusImediato);
  }

  const scoreBruto = scoreFaltas + scoreOcorrencias + scoreRecencia;
  const score = Math.max(0, Math.min(100, Math.round(scoreBruto)));
  const nivel = calcularNivel(score, entrada.faltasInjustificadas, entrada.ocorrencias, cfg);

  return { score, nivel, fatores };
}

/** Mapeia nível para classes Bootstrap de cor. */
export function corPorNivel(nivel: NivelRisco): string {
  switch (nivel) {
    case 'alto':
      return 'bg-danger';
    case 'medio':
      return 'bg-warning';
    default:
      return 'bg-success';
  }
}

/** Retorna as porcentagens dos limiares para a barra segmentada. */
export function pctLimiares(cfg: ConfigTermometro): { medio: number; alto: number } {
  return { medio: cfg.limiteScoreMedio, alto: cfg.limiteScoreAlto };
}
