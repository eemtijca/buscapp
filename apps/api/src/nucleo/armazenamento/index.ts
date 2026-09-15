import { ambiente } from '../../ambiente.js';
import { criarArmazenamentoDisco } from './disco.js';
import { criarArmazenamentoS3 } from './s3.js';
import type { Armazenamento } from './tipos.js';

let instancia: Armazenamento | null = null;

export function armazenamento(): Armazenamento {
  if (!instancia) {
    instancia =
      ambiente.STORAGE_DRIVER === 's3' ? criarArmazenamentoS3() : criarArmazenamentoDisco();
  }
  return instancia;
}

export { normalizarChave, nomeSeguro, type Armazenamento } from './tipos.js';
