import type { RouteOptions } from 'fastify';
import { prisma } from '../banco/cliente.js';

interface ResultadoContador {
  current: number;
  ttl: number;
}

type RetornoContador = (erro: Error | null, resultado?: ResultadoContador) => void;

interface LinhaContador {
  contagem: number;
  ttl: number;
}

/**
 * Store do `@fastify/rate-limit` apoiado no Postgres, compartilhado entre instâncias.
 * A tabela `rate_limit_contadores` não tem RLS: são contadores operacionais sem dado
 * pessoal, consultados também em contexto anônimo (login). O upsert é atômico e resolve
 * a janela em uma única ida ao banco.
 */
export class StoreRateLimitPostgres {
  incr(chave: string, retorno: RetornoContador, janelaMs: number, _max: number): void {
    void this.incrementar(chave, janelaMs).then(
      (resultado) => retorno(null, resultado),
      (erro: unknown) => retorno(erro instanceof Error ? erro : new Error(String(erro))),
    );
  }

  /** Leitura sem incremento, usada por `createRateLimit({ increment: false })`. */
  read(chave: string, retorno: RetornoContador, janelaMs: number, _max: number): void {
    void this.consultar(chave, janelaMs).then(
      (resultado) => retorno(null, resultado),
      (erro: unknown) => retorno(erro instanceof Error ? erro : new Error(String(erro))),
    );
  }

  child(_opcoesDaRota: RouteOptions & { path: string; prefix: string }): StoreRateLimitPostgres {
    return this;
  }

  private async incrementar(chave: string, janelaMs: number): Promise<ResultadoContador> {
    const linhas = await prisma.$queryRaw<LinhaContador[]>`
      insert into public.rate_limit_contadores as r (chave, contagem, expira_em)
      values (${chave}, 1, now() + (${janelaMs} * interval '1 millisecond'))
      on conflict (chave) do update
        set contagem = case when r.expira_em <= now() then 1 else r.contagem + 1 end,
            expira_em = case when r.expira_em <= now() then excluded.expira_em else r.expira_em end
      returning r.contagem as contagem,
                greatest(0, extract(epoch from (r.expira_em - now())) * 1000)::int as ttl
    `;

    const linha = linhas[0];
    return linha
      ? { current: Number(linha.contagem), ttl: Number(linha.ttl) }
      : { current: 1, ttl: janelaMs };
  }

  private async consultar(chave: string, janelaMs: number): Promise<ResultadoContador> {
    const linhas = await prisma.$queryRaw<LinhaContador[]>`
      select contagem,
             greatest(0, extract(epoch from (expira_em - now())) * 1000)::int as ttl
      from public.rate_limit_contadores
      where chave = ${chave} and expira_em > now()
    `;

    const linha = linhas[0];
    return linha
      ? { current: Number(linha.contagem), ttl: Number(linha.ttl) }
      : { current: 0, ttl: janelaMs };
  }
}
