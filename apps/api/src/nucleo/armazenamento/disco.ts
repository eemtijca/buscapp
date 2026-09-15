import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ambiente } from '../../ambiente.js';
import { normalizarChave, type Armazenamento } from './tipos.js';

export function criarArmazenamentoDisco(diretorio = ambiente.UPLOAD_DIR): Armazenamento {
  const raiz = path.resolve(process.cwd(), diretorio);

  function caminhoAbsoluto(chave: string): string {
    const destino = path.resolve(raiz, normalizarChave(chave));
    if (!destino.startsWith(`${raiz}${path.sep}`)) {
      throw new Error('Caminho de armazenamento fora do diretório base.');
    }
    return destino;
  }

  return {
    async salvar(chave, dados) {
      const destino = caminhoAbsoluto(chave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, dados);
    },
    async ler(chave) {
      return readFile(caminhoAbsoluto(chave));
    },
    async lerFluxo(chave) {
      return createReadStream(caminhoAbsoluto(chave));
    },
    async remover(chave) {
      await rm(caminhoAbsoluto(chave), { force: true });
    },
  };
}
