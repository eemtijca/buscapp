// Dados de ambiente e IDs de seed — fonte única para todos os specs.

export const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL não definida: configure o .env da raiz (postgresql://buscapp:buscapp@127.0.0.1:5433/buscapp) ou exporte a variável.',
  );
}
export const DATABASE_URL = databaseUrl;

/** Conexão dona do schema, usada apenas para fixtures/limpeza dos testes (bypassa RLS). */
export const DATABASE_URL_ADMIN = process.env.DATABASE_URL_ADMIN ?? databaseUrl;

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
