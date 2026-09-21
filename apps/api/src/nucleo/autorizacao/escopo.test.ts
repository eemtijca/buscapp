import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PerfilAutenticado } from '../autenticacao/tipos.js';
import { prisma } from '../banco/cliente.js';
import { contextoBanco } from '../banco/contexto.js';
import { idsDeAlunosVisiveis } from './escopo.js';

const professor = {
  id: 'professor-1',
  nome: 'Professor Teste',
  email: 'prof@escola.edu.br',
  papel: 'professor',
  status: 'ativo',
  telefone: null,
  cargo: null,
  notificacoes_ativas: true,
  acesso_modulos: ['frequencia'],
} satisfies PerfilAutenticado;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('escopo por requisição', () => {
  it('resolve o escopo uma única vez dentro da mesma requisição', async () => {
    const atribuicoes = vi
      .spyOn(prisma.atribuicoes_professores, 'findMany')
      .mockResolvedValue([{ turma_id: 'turma-1' }] as never);
    const enturmacoes = vi
      .spyOn(prisma.enturmacoes, 'findMany')
      .mockResolvedValue([{ aluno_id: 'aluno-1' }] as never);

    await contextoBanco.run({ usuarioId: professor.id, emTransacao: false }, async () => {
      expect(await idsDeAlunosVisiveis(professor)).toEqual(['aluno-1']);
      expect(await idsDeAlunosVisiveis(professor)).toEqual(['aluno-1']);
    });

    expect(atribuicoes).toHaveBeenCalledTimes(1);
    expect(enturmacoes).toHaveBeenCalledTimes(1);
  });

  it('resolve de novo em uma nova requisição', async () => {
    const atribuicoes = vi
      .spyOn(prisma.atribuicoes_professores, 'findMany')
      .mockResolvedValue([{ turma_id: 'turma-1' }] as never);
    vi.spyOn(prisma.enturmacoes, 'findMany').mockResolvedValue([{ aluno_id: 'aluno-1' }] as never);

    await contextoBanco.run({ usuarioId: professor.id, emTransacao: false }, async () => {
      await idsDeAlunosVisiveis(professor);
    });
    await contextoBanco.run({ usuarioId: professor.id, emTransacao: false }, async () => {
      await idsDeAlunosVisiveis(professor);
    });

    expect(atribuicoes).toHaveBeenCalledTimes(2);
  });

  it('gestão não consulta escopo e enxerga todos os alunos', async () => {
    const atribuicoes = vi.spyOn(prisma.atribuicoes_professores, 'findMany');

    const gestao = { ...professor, papel: 'gestao' } satisfies PerfilAutenticado;
    await contextoBanco.run({ usuarioId: gestao.id, emTransacao: false }, async () => {
      expect(await idsDeAlunosVisiveis(gestao)).toBeNull();
    });

    expect(atribuicoes).not.toHaveBeenCalled();
  });
});
