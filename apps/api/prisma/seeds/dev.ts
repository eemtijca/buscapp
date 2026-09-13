import { prisma } from '../../src/nucleo/banco/cliente.js';
import { gerarHashSenha } from '../../src/nucleo/autenticacao/senhas.js';

interface UsuarioSeed {
  id: string;
  nome: string;
  email: string;
  papel: 'gestao' | 'professor' | 'responsavel';
  senha: string;
  acesso_modulos: string[];
}

const MODULOS_PROFESSOR = ['frequencia', 'ocorrencias'];
const MODULOS_RESPONSAVEL = ['alertas', 'termometro', 'justificativa', 'chat'];

function usuarios(): UsuarioSeed[] {
  const senhaAdmin = process.env.SEED_SENHA_ADMIN ?? 'Admin123!';
  const senhaProf = process.env.SEED_SENHA_PROF ?? 'Prof123!';
  const senhaResp = process.env.SEED_SENHA_RESP ?? 'Resp123!';

  return [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      nome: 'Carlos Administrador',
      email: 'gestao@escola.edu.br',
      papel: 'gestao',
      senha: senhaAdmin,
      acesso_modulos: [],
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      nome: 'Ana Professora',
      email: 'prof1@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: MODULOS_PROFESSOR,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      nome: 'Bruno Professor',
      email: 'prof2@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: MODULOS_PROFESSOR,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      nome: 'Carla Docente',
      email: 'prof3@escola.edu.br',
      papel: 'professor',
      senha: senhaProf,
      acesso_modulos: MODULOS_PROFESSOR,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      nome: 'Maria Silva',
      email: 'resp1@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      nome: 'João Santos',
      email: 'resp2@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000007',
      nome: 'Lucia Oliveira',
      email: 'resp3@email.com',
      papel: 'responsavel',
      senha: senhaResp,
      acesso_modulos: MODULOS_RESPONSAVEL,
    },
  ];
}

/** Cria/atualiza os usuários de desenvolvimento com as mesmas credenciais do seed legado. */
export async function executarSeed(): Promise<void> {
  for (const usuario of usuarios()) {
    const senhaHash = await gerarHashSenha(usuario.senha);
    await prisma.perfis.upsert({
      where: { id: usuario.id },
      create: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        status: 'ativo',
        senha_hash: senhaHash,
        senha_alterada_em: new Date(),
        acesso_modulos: usuario.acesso_modulos,
      },
      update: {
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        status: 'ativo',
        senha_hash: senhaHash,
        acesso_modulos: usuario.acesso_modulos,
      },
    });
  }
  console.log('Seed de desenvolvimento aplicado (7 perfis).');
}

await executarSeed()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error('Falha ao aplicar o seed:', erro);
    await prisma.$disconnect();
    process.exit(1);
  });
