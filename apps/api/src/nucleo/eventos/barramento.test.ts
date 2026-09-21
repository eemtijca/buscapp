import { Writable } from 'node:stream';
import type { FastifyReply } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  conectarEventos,
  contarConexoes,
  contarConexoesPorUsuario,
  encerrarConexoes,
  MAX_CONEXOES_POR_USUARIO,
} from './barramento.js';

interface RespostaFalsa {
  resposta: FastifyReply;
  bruto: Writable;
  pedacos: string[];
}

const abertas: Writable[] = [];

function criarResposta(): RespostaFalsa {
  const pedacos: string[] = [];
  const bruto = new Writable({
    write(pedaco, _codificacao, retorno) {
      pedacos.push(String(pedaco));
      retorno();
    },
  }) as Writable & { writeHead: () => void };
  bruto.writeHead = () => undefined;
  abertas.push(bruto);

  return {
    resposta: { hijack: () => undefined, raw: bruto } as unknown as FastifyReply,
    bruto,
    pedacos,
  };
}

afterEach(async () => {
  for (const fluxo of abertas) fluxo.end();
  abertas.length = 0;
  await new Promise((resolver) => setImmediate(resolver));
});

describe('conexões SSE', () => {
  it('mantém no máximo três conexões por usuário e encerra a mais antiga', () => {
    const conexoes = Array.from({ length: 4 }, () => criarResposta());
    for (const conexao of conexoes) conectarEventos('usuario-1', conexao.resposta);

    expect(contarConexoesPorUsuario('usuario-1')).toBe(MAX_CONEXOES_POR_USUARIO);
    expect(conexoes[0]!.bruto.writableEnded).toBe(true);
    expect(conexoes[0]!.pedacos.join('')).toContain('limite_conexoes');
    expect(conexoes[3]!.bruto.writableEnded).toBe(false);
  });

  it('não interfere nas conexões de outros usuários', () => {
    const primeiro = criarResposta();
    conectarEventos('usuario-1', primeiro.resposta);

    const outros = Array.from({ length: 4 }, () => criarResposta());
    for (const conexao of outros) conectarEventos('usuario-2', conexao.resposta);

    expect(primeiro.bruto.writableEnded).toBe(false);
    expect(contarConexoesPorUsuario('usuario-1')).toBe(1);
    expect(contarConexoesPorUsuario('usuario-2')).toBe(MAX_CONEXOES_POR_USUARIO);
  });

  it('libera a vaga quando uma conexão é encerrada', async () => {
    const conexoes = Array.from({ length: 3 }, () => criarResposta());
    for (const conexao of conexoes) conectarEventos('usuario-1', conexao.resposta);

    conexoes[0]!.bruto.end();
    await new Promise((resolver) => setImmediate(resolver));

    expect(contarConexoesPorUsuario('usuario-1')).toBe(2);

    const nova = criarResposta();
    conectarEventos('usuario-1', nova.resposta);
    expect(contarConexoesPorUsuario('usuario-1')).toBe(3);
    expect(nova.bruto.writableEnded).toBe(false);
  });

  it('zera a contagem global quando todas as conexões fecham', async () => {
    const conexoes = Array.from({ length: 2 }, () => criarResposta());
    for (const conexao of conexoes) conectarEventos('usuario-1', conexao.resposta);

    for (const conexao of conexoes) conexao.bruto.end();
    await new Promise((resolver) => setImmediate(resolver));

    expect(contarConexoes()).toBe(0);
  });

  it('encerra todas as conexões com aviso no shutdown', () => {
    const primeira = criarResposta();
    const segunda = criarResposta();
    conectarEventos('usuario-1', primeira.resposta);
    conectarEventos('usuario-2', segunda.resposta);

    expect(contarConexoes()).toBe(2);
    expect(encerrarConexoes()).toBe(2);
    expect(contarConexoes()).toBe(0);
    expect(primeira.bruto.writableEnded).toBe(true);
    expect(segunda.bruto.writableEnded).toBe(true);
    expect(primeira.pedacos.join('')).toContain('servidor_encerrando');
  });
});
