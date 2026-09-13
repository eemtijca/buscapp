import { hashSync } from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { gerarHashSenha, HASH_FALSO, precisaRehash, verificarSenha } from './senhas.js';

describe('senhas', () => {
  it('gera hash scrypt e verifica a senha correta', async () => {
    const hash = await gerarHashSenha('SenhaForte1!');
    expect(hash.startsWith('scrypt$32768$8$1$')).toBe(true);
    await expect(verificarSenha('SenhaForte1!', hash)).resolves.toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = await gerarHashSenha('SenhaForte1!');
    await expect(verificarSenha('OutraSenha1!', hash)).resolves.toBe(false);
  });

  it('não quebra com hash corrompido', async () => {
    await expect(verificarSenha('SenhaForte1!', 'scrypt$invalido')).resolves.toBe(false);
    await expect(verificarSenha('SenhaForte1!', 'formato-desconhecido')).resolves.toBe(false);
  });

  it('verifica hashes bcrypt legados do Supabase', async () => {
    const legado = hashSync('SenhaAntiga1!', 10);
    await expect(verificarSenha('SenhaAntiga1!', legado)).resolves.toBe(true);
    await expect(verificarSenha('Errada1!', legado)).resolves.toBe(false);
  });

  it('não vaza o tempo de resposta para usuário inexistente', async () => {
    await expect(verificarSenha('Qualquer1!', HASH_FALSO)).resolves.toBe(false);
  });

  it('indica quando o hash precisa ser regenerado', async () => {
    expect(precisaRehash('$2a$10$hashlegado')).toBe(true);
    expect(precisaRehash('scrypt$16384$8$1$aa$bb')).toBe(true);
    const atual = await gerarHashSenha('SenhaForte1!');
    expect(precisaRehash(atual)).toBe(false);
  });
});
