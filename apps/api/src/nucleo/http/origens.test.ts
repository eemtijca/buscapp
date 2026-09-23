import { describe, expect, it } from 'vitest';
import { criarVerificadorOrigens, normalizarDominiosOrigem } from './origens.js';

const sufixo = 'preview.example.com';
const origemPreview = `https://buscapp-fix.${sufixo}`;
const verificar = criarVerificadorOrigens(['https://buscappjca.vercel.app'], [sufixo]);

describe('origens confiáveis', () => {
  it('normaliza e remove domínios duplicados', () => {
    expect(
      normalizarDominiosOrigem(` Preview.Example.com,preview.example.com,preview.example.com `),
    ).toEqual([sufixo]);
  });

  it.each([
    'https://preview.example.com',
    'preview.example.com/path',
    'preview.example.com:443',
    '*.preview.example.com',
    'preview..example.com',
    'localhost',
    '127.0.0.1',
  ])('rejeita domínio de origem inválido: %s', (dominio) => {
    expect(() => normalizarDominiosOrigem(dominio)).toThrow('Domínio de origem inválido');
  });

  it('aceita a origem exata de produção', () => {
    expect(verificar('https://buscappjca.vercel.app')).toBe(true);
  });

  it('aceita um subdomínio HTTPS do sufixo confiável', () => {
    expect(verificar(origemPreview)).toBe(true);
  });

  it('aceita o próprio sufixo confiável', () => {
    expect(verificar(`https://${sufixo}`)).toBe(true);
  });

  it('rejeita outro domínio Vercel', () => {
    expect(verificar('https://buscapp-outro.vercel.app')).toBe(false);
  });

  it('rejeita prefixo sem limite de rótulo DNS', () => {
    expect(verificar(`https://naopreview.example.com`)).toBe(false);
  });

  it('rejeita domínio que contém o sufixo antes do domínio final', () => {
    expect(verificar(`https://${sufixo}.evil.example`)).toBe(false);
  });

  it('rejeita HTTP', () => {
    expect(verificar(`http://${sufixo}`)).toBe(false);
  });

  it.each([
    undefined,
    'null',
    'não é uma origem',
    'https://preview.example.com/path',
    'https://preview.example.com:8443',
    'https://user:senha@preview.example.com',
  ])('rejeita origem malformada: %s', (origem) => {
    expect(verificar(origem)).toBe(false);
  });

  it('não amplia as origens quando não há sufixos', () => {
    const verificarSemSufixos = criarVerificadorOrigens(['https://buscappjca.vercel.app'], []);

    expect(verificarSemSufixos(origemPreview)).toBe(false);
  });
});
