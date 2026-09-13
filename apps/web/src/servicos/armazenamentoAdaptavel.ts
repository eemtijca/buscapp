const CHAVE_LEMBRAR = 'sb-lembrar';

class ArmazenamentoAdaptavel implements Storage {
  private armazenamentoAtivo: Storage;

  constructor() {
    const lembrar = localStorage.getItem(CHAVE_LEMBRAR) === 'true';
    this.armazenamentoAtivo = lembrar ? localStorage : sessionStorage;
  }

  getItem(key: string): string | null {
    return this.armazenamentoAtivo.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.armazenamentoAtivo.setItem(key, value);
  }

  removeItem(key: string): void {
    this.armazenamentoAtivo.removeItem(key);
  }

  get length(): number {
    return this.armazenamentoAtivo.length;
  }

  clear(): void {
    this.armazenamentoAtivo.clear();
  }

  key(index: number): string | null {
    return this.armazenamentoAtivo.key(index);
  }

  definirLembrar(lembrar: boolean): void {
    this.armazenamentoAtivo = lembrar ? localStorage : sessionStorage;
    localStorage.setItem(CHAVE_LEMBRAR, String(lembrar));
  }

  limparTudo(): void {
    const chavesAuth: string[] = [];

    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          chavesAuth.push(key);
        }
      }
    }

    for (const key of new Set(chavesAuth)) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }

    localStorage.removeItem(CHAVE_LEMBRAR);
  }
}

export const armazenamento = new ArmazenamentoAdaptavel();
