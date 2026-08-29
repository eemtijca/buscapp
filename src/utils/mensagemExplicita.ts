// Mensagens explícitas de sucesso e erro com horário e contexto da entidade.
import { traduzirErro } from '@/utils/traduzirErro';

function horaAtual(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function normalizarNome(nome: string): string {
  const t = nome.trim();
  return t ? `"${t}"` : '';
}

export function mensagemSucesso(
  entidade: string,
  nome: string,
  acao: 'criado' | 'criada' | 'atualizado' | 'atualizada' | 'salvo' | 'salva',
): string {
  const alvo = normalizarNome(nome);
  const base = alvo ? `${entidade} ${alvo}` : entidade;
  return `${base} ${acao} com sucesso às ${horaAtual()}.`;
}

export function mensagemErroExplicita(
  entidade: string,
  nome: string,
  acao: string,
  erro: unknown,
): string {
  const alvo = normalizarNome(nome);
  const base = alvo ? `${entidade} ${alvo}` : entidade;
  const detalhe = (() => {
    try {
      return traduzirErro(erro).mensagem;
    } catch {
      return erro instanceof Error ? erro.message : String(erro);
    }
  })();
  return `${base} falhou ao ${acao}: ${detalhe}`;
}

export function mensagemSucessoGenerica(entidade: string, acao: string): string {
  return `${entidade} ${acao} com sucesso às ${horaAtual()}.`;
}

export function mensagemErroGenerica(entidade: string, acao: string, erro: unknown): string {
  const detalhe = (() => {
    try {
      return traduzirErro(erro).mensagem;
    } catch {
      return erro instanceof Error ? erro.message : String(erro);
    }
  })();
  return `${entidade} falhou ao ${acao}: ${detalhe}`;
}
