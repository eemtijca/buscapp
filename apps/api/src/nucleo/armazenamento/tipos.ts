export interface Armazenamento {
  salvar(chave: string, dados: Buffer, mimeType: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  remover(chave: string): Promise<void>;
}

/** Remove componentes de caminho que permitam escapar do diretório base. */
export function normalizarChave(chave: string): string {
  const normalizada = chave
    .replace(/\\/g, '/')
    .split('/')
    .filter((parte) => parte && parte !== '.' && parte !== '..')
    .join('/');
  if (!normalizada) throw new Error('Chave de armazenamento inválida.');
  return normalizada;
}

/** Sanitiza o nome original do arquivo para uso em chaves. */
export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? 'arquivo';
  const limpo = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
  return limpo || 'arquivo';
}
