import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';
import { armazenamento } from './armazenamentoAdaptavel';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não definidas. O cliente não será inicializado.',
  );
}

export const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { storage: armazenamento },
  realtime: {
    worker: true,
    heartbeatCallback(status) {
      if (status === 'disconnected') void supabaseClient.realtime.connect();
    },
  },
});

/** Claims injetadas no JWT via Custom Access Token Hook. */
interface TokenClaims {
  sub: string;
  email: string;
  nome: string;
  papel: string;
  [key: string]: unknown;
}

/**
 * Decodifica o JWT sem latência de rede (diferente de getSession()).
 * Usado pelo router guard para ler 'papel' da claim do token.
 */
export { armazenamento };

export function decodificarToken(accessToken: string): TokenClaims | null {
  try {
    const claims = jwtDecode<TokenClaims>(accessToken);
    return claims;
  } catch {
    return null;
  }
}
