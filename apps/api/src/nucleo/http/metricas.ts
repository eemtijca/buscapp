interface Contadores {
  total: number;
  errosCliente: number;
  errosServidor: number;
  muitasRequisicoes: number;
  somaDuracaoMs: number;
}

const contadores: Contadores = {
  total: 0,
  errosCliente: 0,
  errosServidor: 0,
  muitasRequisicoes: 0,
  somaDuracaoMs: 0,
};

/** Registra uma resposta para o resumo operacional. */
export function registrarRequisicao(status: number, duracaoMs: number): void {
  contadores.total += 1;
  contadores.somaDuracaoMs += duracaoMs;
  if (status >= 500) contadores.errosServidor += 1;
  else if (status === 429) contadores.muitasRequisicoes += 1;
  else if (status >= 400) contadores.errosCliente += 1;
}

export interface ResumoMetricas {
  total: number;
  erros_cliente: number;
  erros_servidor: number;
  muitas_requisicoes: number;
  media_ms: number;
}

export function resumoMetricas(): ResumoMetricas {
  return {
    total: contadores.total,
    erros_cliente: contadores.errosCliente,
    erros_servidor: contadores.errosServidor,
    muitas_requisicoes: contadores.muitasRequisicoes,
    media_ms: contadores.total ? Math.round(contadores.somaDuracaoMs / contadores.total) : 0,
  };
}

/** Zera os contadores; usado nos testes. */
export function reiniciarMetricas(): void {
  contadores.total = 0;
  contadores.errosCliente = 0;
  contadores.errosServidor = 0;
  contadores.muitasRequisicoes = 0;
  contadores.somaDuracaoMs = 0;
}
