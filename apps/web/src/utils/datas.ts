/** Fuso padrão da escola; a API expõe o valor efetivo em `configuracoes.fuso_horario`. */
export const FUSO_HORARIO_PADRAO = 'America/Sao_Paulo';

const DIAS_SEMANA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Data civil de hoje no fuso local em `yyyy-mm-dd`. */
export function hojeIso(): string {
  return isoLocal(new Date());
}

/** Data civil de uma data qualquer no fuso local em `yyyy-mm-dd`. */
export function isoLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Dia da semana e minutos do dia em um fuso IANA, independentes do fuso do navegador.
 * Espelha o helper `partesNaEscola` da API para que o cliente e o servidor decidam igual.
 */
export function partesNoFuso(
  data: Date,
  fuso: string = FUSO_HORARIO_PADRAO,
): { diaSemana: number; minutos: number } {
  try {
    const formatador = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const partes = formatador.formatToParts(data);
    const valor = (tipo: string): string =>
      partes.find((parte) => parte.type === tipo)?.value ?? '';

    const diaSemana = DIAS_SEMANA[valor('weekday')] ?? data.getDay();
    const horas = Number(valor('hour')) % 24;
    return { diaSemana, minutos: horas * 60 + Number(valor('minute')) };
  } catch {
    return { diaSemana: data.getDay(), minutos: data.getHours() * 60 + data.getMinutes() };
  }
}

/** Converte uma data ISO para `dd/mm/aaaa`, preservando o dia civil quando possível. */
export function formatarData(iso: string): string {
  if (!iso) return '';
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes?.[1] && partes[2] && partes[3]) return `${partes[3]}/${partes[2]}/${partes[1]}`;
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Separa data e horário de um timestamp ISO. Datas civis ficam sem horário. */
export function formatarDataHorario(iso: string): { data: string; horario: string } {
  if (!iso) return { data: '', horario: '' };

  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dataCivil = partes?.[1] && partes[2] && partes[3] ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';

  if (!iso.includes('T')) return { data: dataCivil || iso, horario: '' };

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return { data: dataCivil || iso, horario: '' };

  return {
    data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    horario: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Dias civis entre duas datas ISO (`yyyy-mm-dd`). */
export function diasEntre(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Iniciais do nome para avatares e rótulos compactos. */
export function iniciaisDoNome(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}
