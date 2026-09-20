import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prismaAdmin as prisma } from './nucleo/banco/cliente.js';

const marcador = Date.now();
const anoAId = randomUUID();
const anoBId = randomUUID();
const turmaId = randomUUID();
const alunoId = randomUUID();
const perfilId = randomUUID();
const email = `integridade.${marcador}@escola.edu.br`;

beforeAll(async () => {
  await prisma.anos_letivos.createMany({
    data: [
      {
        id: anoAId,
        ano: 2098,
        status: 'planejado',
        data_inicio: new Date('2098-02-01'),
        data_fim: new Date('2098-12-20'),
        ativo: false,
      },
      {
        id: anoBId,
        ano: 2097,
        status: 'planejado',
        data_inicio: new Date('2097-02-01'),
        data_fim: new Date('2097-12-20'),
        ativo: false,
      },
    ],
  });

  // Garante um ano ativo para o teste da unicidade, sem depender do seed.
  const ativos = await prisma.anos_letivos.count({ where: { ativo: true } });
  if (ativos === 0) {
    await prisma.anos_letivos.update({
      where: { id: anoAId },
      data: { ativo: true, status: 'ativo' },
    });
  }
  await prisma.turmas.create({
    data: {
      id: turmaId,
      ano_letivo_id: anoAId,
      serie: '1ª',
      letra: 'A',
      nome_completo: `1ª A Integridade ${marcador}`,
      ativo: true,
    },
  });
  await prisma.alunos.create({
    data: { id: alunoId, nome: 'Aluno Integridade', matricula: `INT${marcador}` },
  });
  await prisma.perfis.create({
    data: {
      id: perfilId,
      nome: 'Perfil Integridade',
      email: `perfil.integridade.${marcador}@escola.edu.br`,
      papel: 'gestao',
      status: 'ativo',
    },
  });
});

afterAll(async () => {
  await prisma.enturmacoes.deleteMany({ where: { aluno_id: alunoId } });
  await prisma.anexos.deleteMany({ where: { storage_path: { contains: `integridade-${marcador}` } } });
  await prisma.codigos_redefinicao.deleteMany({ where: { email } });
  await prisma.alunos.deleteMany({ where: { id: alunoId } });
  await prisma.turmas.deleteMany({ where: { id: turmaId } });
  await prisma.anos_letivos.deleteMany({ where: { id: { in: [anoAId, anoBId] } } });
  await prisma.perfis.deleteMany({ where: { id: perfilId } });
  await prisma.$disconnect();
});

describe('restrições de integridade', () => {
  it('impede dois anos letivos ativos', async () => {
    await expect(
      prisma.anos_letivos.update({ where: { id: anoBId }, data: { ativo: true, status: 'ativo' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('impede storage_path duplicado', async () => {
    const chave = `integridade-${marcador}/arquivo.pdf`;
    await prisma.anexos.create({
      data: {
        storage_path: chave,
        nome_arquivo: 'arquivo.pdf',
        mime_type: 'application/pdf',
        tamanho_bytes: 10,
      },
    });

    await expect(
      prisma.anexos.create({
        data: {
          storage_path: chave,
          nome_arquivo: 'outro.pdf',
          mime_type: 'application/pdf',
          tamanho_bytes: 10,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('impede dois códigos ativos para o mesmo email', async () => {
    const criar = () =>
      prisma.codigos_redefinicao.create({
        data: {
          email,
          perfil_id: perfilId,
          codigo_hash: randomUUID(),
          expira_em: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

    await criar();
    await expect(criar()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('impede enturmação com ano letivo divergente da turma', async () => {
    await expect(
      prisma.enturmacoes.create({
        data: {
          aluno_id: alunoId,
          turma_id: turmaId,
          ano_letivo_id: anoBId,
          status: 'matriculado',
        },
      }),
    ).rejects.toThrow(/não pertence ao ano letivo/);
  });

  it('impede mudar o ano de uma turma com enturmações', async () => {
    await prisma.enturmacoes.create({
      data: {
        aluno_id: alunoId,
        turma_id: turmaId,
        ano_letivo_id: anoAId,
        status: 'matriculado',
      },
    });

    await expect(
      prisma.turmas.update({ where: { id: turmaId }, data: { ano_letivo_id: anoBId } }),
    ).rejects.toThrow(/Não é possível alterar o ano letivo/);
  });
});
