import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { compare as compararBcrypt } from 'bcryptjs';

const derivar = promisify(scryptCallback) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMETROS = {
  N: 32768,
  r: 8,
  p: 1,
  tamanho: 64,
  sal: 16,
  maxmem: 128 * 1024 * 1024,
};

/** Hash fictício usado para equalizar o tempo de resposta quando o usuário não existe. */
export const HASH_FALSO = `scrypt$${PARAMETROS.N}$${PARAMETROS.r}$${PARAMETROS.p}$${'00'.repeat(PARAMETROS.sal)}$${'00'.repeat(PARAMETROS.tamanho)}`;

/** Gera hash scrypt no formato `scrypt$N$r$p$salHex$chaveHex`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(PARAMETROS.sal);
  const chave = await derivar(senha, sal, PARAMETROS.tamanho, {
    N: PARAMETROS.N,
    r: PARAMETROS.r,
    p: PARAMETROS.p,
    maxmem: PARAMETROS.maxmem,
  });
  return `scrypt$${PARAMETROS.N}$${PARAMETROS.r}$${PARAMETROS.p}$${sal.toString('hex')}$${chave.toString('hex')}`;
}

/** Verifica senha contra scrypt próprio ou bcrypt legado do Supabase Auth. */
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  if (hash.startsWith('scrypt$')) {
    const partes = hash.split('$');
    if (partes.length !== 6) return false;
    const [, nTexto, rTexto, pTexto, salHex, chaveHex] = partes;
    const N = Number(nTexto);
    const r = Number(rTexto);
    const p = Number(pTexto);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    const chaveEsperada = Buffer.from(chaveHex ?? '', 'hex');
    const derivada = await derivar(senha, Buffer.from(salHex ?? '', 'hex'), chaveEsperada.length, {
      N,
      r,
      p,
      maxmem: PARAMETROS.maxmem,
    });
    return derivada.length === chaveEsperada.length && timingSafeEqual(derivada, chaveEsperada);
  }

  if (hash.startsWith('$2')) {
    try {
      return await compararBcrypt(senha, hash);
    } catch {
      return false;
    }
  }

  return false;
}

/** Hashes bcrypt legados ou scrypt com parâmetros antigos precisam ser regenerados. */
export function precisaRehash(hash: string): boolean {
  if (!hash.startsWith('scrypt$')) return true;
  const [, nTexto] = hash.split('$');
  return Number(nTexto) !== PARAMETROS.N;
}
