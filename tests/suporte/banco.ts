// Acesso direto ao Postgres (pg) para preparo e limpeza de dados de teste.

import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_URL, DATABASE_URL_ADMIN } from './dados.js';

const URL_FIXTURES = DATABASE_URL_ADMIN ?? DATABASE_URL;

let pool: Pool | null = null;

function obterPool(): Pool {
  pool ??= new Pool({ connectionString: URL_FIXTURES, application_name: 'buscapp-e2e', max: 4 });
  return pool;
}

/** Executa um SELECT parametrizado e devolve as linhas. */
export async function consultar<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const resultado = await obterPool().query<T>(sql, params);
  return resultado.rows;
}

/** Executa um comando parametrizado e devolve o número de linhas afetadas. */
export async function executar(sql: string, params: unknown[] = []): Promise<number> {
  const resultado = await obterPool().query(sql, params);
  return resultado.rowCount ?? 0;
}

// Nomes de tabela/coluna vêm dos specs (schema do projeto), nunca de input do usuário.
function validarIdentificador(nome: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(nome)) {
    throw new Error(`Identificador SQL inválido: ${nome}`);
  }
  return nome;
}

/**
 * Insere linhas em uma tabela com as colunas derivadas do próprio JSON.
 * Colunas omitidas usam os defaults do banco (id, created_at, status, ...).
 */
export async function inserirLinhas(
  tabela: string,
  linhas: Record<string, unknown>[],
): Promise<void> {
  if (linhas.length === 0) return;
  const nomeTabela = validarIdentificador(tabela);
  const colunas = [...new Set(linhas.flatMap((linha) => Object.keys(linha)))];
  if (colunas.length === 0) throw new Error(`Nenhuma coluna informada para ${tabela}`);
  const listaColunas = colunas.map((coluna) => `"${validarIdentificador(coluna)}"`).join(', ');
  await executar(
    `insert into public."${nomeTabela}" (${listaColunas})
     select ${listaColunas} from json_populate_recordset(null::public."${nomeTabela}", $1::json)`,
    [JSON.stringify(linhas)],
  );
}

/** Remove linhas de uma tabela; `whereSql` é um fragmento fixo do spec com placeholders. */
export async function excluirLinhas(
  tabela: string,
  whereSql: string,
  params: unknown[] = [],
): Promise<number> {
  const nomeTabela = validarIdentificador(tabela);
  return executar(`delete from public."${nomeTabela}" where ${whereSql}`, params);
}

/** Encerra o pool; chame no `afterAll` para o worker terminar limpo. */
export async function fecharBanco(): Promise<void> {
  const atual = pool;
  pool = null;
  if (atual) await atual.end();
}
