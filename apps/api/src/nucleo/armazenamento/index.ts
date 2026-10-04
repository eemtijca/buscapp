import { ambiente } from '../../ambiente.js';
import { criarArmazenamentoAzureBlob } from './azure-blob.js';
import { criarArmazenamentoDisco } from './disco.js';
import { criarArmazenamentoS3 } from './s3.js';
import type { Armazenamento } from './tipos.js';

let instancia: Armazenamento | null = null;

export function armazenamento(): Armazenamento {
  if (!instancia) {
    if (ambiente.STORAGE_DRIVER === 's3') {
      instancia = criarArmazenamentoS3();
    } else if (ambiente.STORAGE_DRIVER === 'azure-blob') {
      instancia = criarArmazenamentoAzureBlob();
    } else {
      instancia = criarArmazenamentoDisco();
    }
  }
  return instancia;
}

export { normalizarChave, nomeSeguro, type Armazenamento } from './tipos.js';
