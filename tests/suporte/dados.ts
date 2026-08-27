// Dados de ambiente e IDs de seed — fonte única para todos os specs.

export const URL_SUPABASE = process.env.VITE_SUPABASE_URL!;
if (!URL_SUPABASE) throw new Error('VITE_SUPABASE_URL não definida');

export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida');

export const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
if (!PUBLISHABLE_KEY) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY não definida');

export const SENHA_ADMIN = process.env.SEED_SENHA_ADMIN!;
export const SENHA_PROF = process.env.SEED_SENHA_PROF!;
export const SENHA_RESP = process.env.SEED_SENHA_RESP!;

// IDs de seed — usados em RLS e gating de módulos.
export const GESTAO_ID = 'a0000000-0000-0000-0000-000000000001';
export const PROF1_ID = 'a0000000-0000-0000-0000-000000000002';
export const PROF2_ID = 'a0000000-0000-0000-0000-000000000003';
export const RESP1_ID = 'a0000000-0000-0000-0000-000000000005';
export const ALUNO_LUCAS_ID = 'e0000000-0000-0000-0000-000000000005';
export const ALUNO_JOAO_ID = 'e0000000-0000-0000-0000-000000000001';
export const TURMA_1A_ID = 'd0000000-0000-0000-0000-000000000001';
export const TURMA_2B_ID = 'd0000000-0000-0000-0000-000000000002';
export const ANO_LETIVO_ID = 'b0000000-0000-0000-0000-000000000001';

/** Gera e-mail único por execução para evitar colisão entre workers. */
export function emailUnico(prefixo: string): string {
  const sufixo = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefixo}${sufixo}@test.com`;
}
