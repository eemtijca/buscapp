import { describe, expect, it } from 'vitest';
import { horarioPermitido } from './chat.servico.js';

const FUSO = 'America/Sao_Paulo';

function horario(
  dia_semana: number,
  hora_inicio: string,
  hora_fim: string,
  ativo = true,
): {
  dia_semana: number;
  hora_inicio: Date;
  hora_fim: Date;
  ativo: boolean;
} {
  return {
    dia_semana,
    hora_inicio: new Date(`1970-01-01T${hora_inicio}:00Z`),
    hora_fim: new Date(`1970-01-01T${hora_fim}:00Z`),
    ativo,
  };
}

// Segunda-feira, 2 de março de 2026: 10:00 UTC = 07:00 em São Paulo (UTC-3).
const SEGUNDA_7H = new Date('2026-03-02T10:00:00Z');
// 23:00 UTC = 20:00 em São Paulo.
const SEGUNDA_20H = new Date('2026-03-02T23:00:00Z');
// Sábado, 7 de março de 2026, 10:00 UTC = 07:00 em São Paulo.
const SABADO_7H = new Date('2026-03-07T10:00:00Z');

describe('horarioPermitido', () => {
  it('usa a janela escolar padrão quando não há horários cadastrados', () => {
    expect(horarioPermitido([], SEGUNDA_7H, FUSO)).toBe(true);
    expect(horarioPermitido([], SEGUNDA_20H, FUSO)).toBe(false);
    expect(horarioPermitido([], SABADO_7H, FUSO)).toBe(false);
  });

  it('considera o fuso da escola, não o fuso do servidor', () => {
    // 10:00 UTC é 07:00 em São Paulo e 10:00 em UTC.
    const janela = [horario(1, '07:00', '08:00')];
    expect(horarioPermitido(janela, SEGUNDA_7H, FUSO)).toBe(true);
    expect(horarioPermitido(janela, SEGUNDA_7H, 'UTC')).toBe(false);
  });

  it('valida a janela do dia atual, sem misturar dias diferentes', () => {
    // Segunda 07:00-12:00 e terça 13:00-18:00 não podem liberar segunda à tarde.
    const janelas = [horario(1, '07:00', '12:00'), horario(2, '13:00', '18:00')];
    // Segunda, 10:00 em São Paulo, dentro da janela de segunda.
    expect(horarioPermitido(janelas, new Date('2026-03-02T13:00:00Z'), FUSO)).toBe(true);
    // Segunda, 13:00 em São Paulo: a lógica antiga liberava ao misturar os dias.
    expect(horarioPermitido(janelas, new Date('2026-03-02T16:00:00Z'), FUSO)).toBe(false);
    // Terça, 14:00 em São Paulo, dentro da janela de terça.
    expect(horarioPermitido(janelas, new Date('2026-03-03T17:00:00Z'), FUSO)).toBe(true);
  });

  it('bloqueia quando todos os horários estão inativos', () => {
    const janelas = [horario(1, '07:00', '17:00', false)];
    expect(horarioPermitido(janelas, SEGUNDA_7H, FUSO)).toBe(false);
  });
});
