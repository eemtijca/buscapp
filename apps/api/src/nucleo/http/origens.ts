const rotuloDns = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const rotuloFinal = /^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/u;

function normalizarDominio(valor: string): string {
  const dominio = valor.trim().toLowerCase();
  const rotulos = dominio.split('.');

  if (
    dominio.length > 253 ||
    rotulos.length < 2 ||
    !rotuloFinal.test(rotulos.at(-1) ?? '') ||
    rotulos.some((rotulo) => !rotuloDns.test(rotulo))
  ) {
    throw new Error(`Domínio de origem inválido: ${valor}`);
  }

  return dominio;
}

export function normalizarDominiosOrigem(valor: string): string[] {
  const dominios = valor
    .split(',')
    .map((dominio) => dominio.trim())
    .filter(Boolean)
    .map(normalizarDominio);

  return [...new Set(dominios)];
}

export function criarVerificadorOrigens(origens: string[], sufixos: string[]) {
  const origensExatas = new Set(origens.map((origem) => origem.trim()).filter(Boolean));
  const dominiosConfiaveis = normalizarDominiosOrigem(sufixos.join(','));

  return (origem: string | undefined): boolean => {
    if (!origem) return false;
    if (origensExatas.has(origem)) return true;

    try {
      const url = new URL(origem);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        return false;
      }

      const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
      // O ponto exige um limite de rótulo DNS e evita aceitar domínios que só terminam com o sufixo.
      return dominiosConfiaveis.some(
        (dominio) => hostname === dominio || hostname.endsWith(`.${dominio}`),
      );
    } catch {
      return false;
    }
  };
}
