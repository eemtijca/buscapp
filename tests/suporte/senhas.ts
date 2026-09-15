// Geração de hash scrypt no mesmo formato usado pela API (`scrypt$N$r$p$salHex$chaveHex`).

import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scryptCallback) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 32768;
const R = 8;
const P = 1;
const TAMANHO_CHAVE = 64;
const TAMANHO_SAL = 16;
const MAXMEM = 128 * 1024 * 1024;

/** Gera hash no formato `scrypt$N$r$p$salHex$chaveHex`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const chave = await derivar(senha, sal, TAMANHO_CHAVE, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('hex')}$${chave.toString('hex')}`;
}
