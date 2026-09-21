import { ambiente } from '../../ambiente.js';

const DIAS_SEMANA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Dia da semana e minutos do dia no fuso da escola, independentes do fuso do servidor.
 * Em produção o processo roda em UTC, então `getDay()` e `getHours()` não representam
 * o horário da escola.
 */
export function partesNaEscola(
  agora: Date = new Date(),
  fuso: string = ambiente.TZ_ESCOLA,
): { diaSemana: number; minutos: number } {
  try {
    const formatador = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const partes = formatador.formatToParts(agora);
    const valor = (tipo: Intl.DateTimeFormatPartTypes): string =>
      partes.find((parte) => parte.type === tipo)?.value ?? '';

    const diaSemana = DIAS_SEMANA[valor('weekday')] ?? agora.getDay();
    const horas = Number(valor('hour')) % 24;
    const minutos = Number(valor('minute'));

    return { diaSemana, minutos: horas * 60 + minutos };
  } catch {
    return { diaSemana: agora.getDay(), minutos: agora.getHours() * 60 + agora.getMinutes() };
  }
}
