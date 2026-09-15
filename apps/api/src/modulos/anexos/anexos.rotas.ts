import { uuidSchema } from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { armazenamento, nomeSeguro, normalizarChave } from '../../nucleo/armazenamento/index.js';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { ErroHttp } from '../../nucleo/http/erros.js';
import { garantirAcessoAnexo, gerarChaveAnexo, paraAnexo } from './anexos.servico.js';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export const rotasAnexos: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/api/anexos',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      schema: {
        tags: ['anexos'],
        summary: 'Envia um anexo (imagem ou PDF)',
      },
    },
    async (pedido, resposta) => {
      const arquivo = await pedido.file();
      if (!arquivo) {
        throw new ErroHttp(400, 'arquivo_ausente', 'Envie um arquivo no campo "arquivo".');
      }
      if (!TIPOS_PERMITIDOS.includes(arquivo.mimetype)) {
        throw new ErroHttp(400, 'tipo_invalido', 'Formato não aceito. Use JPG, PNG, WEBP ou PDF.');
      }

      let conteudo: Buffer;
      try {
        conteudo = await arquivo.toBuffer();
      } catch {
        throw new ErroHttp(413, 'arquivo_grande', 'O arquivo excede o limite de 10 MB.');
      }
      if (conteudo.length > TAMANHO_MAXIMO) {
        throw new ErroHttp(413, 'arquivo_grande', 'O arquivo excede o limite de 10 MB.');
      }

      const usuario = usuarioAtual(pedido);
      const chave = normalizarChave(gerarChaveAnexo(usuario.id, nomeSeguro(arquivo.filename)));
      await armazenamento().salvar(chave, conteudo, arquivo.mimetype);

      const anexo = await prisma.anexos.create({
        data: {
          storage_path: chave,
          nome_arquivo: arquivo.filename,
          mime_type: arquivo.mimetype,
          tamanho_bytes: conteudo.length,
          criado_por: usuario.id,
        },
      });

      resposta.status(201);
      return { anexo: paraAnexo(anexo) };
    },
  );

  app.get(
    '/api/anexos/:id/arquivo',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      schema: {
        tags: ['anexos'],
        summary: 'Baixa o conteúdo do anexo com autorização',
        params: z.object({ id: uuidSchema }),
      },
    },
    async (pedido, resposta) => {
      const anexo = await garantirAcessoAnexo(usuarioAtual(pedido), pedido.params.id);
      const conteudo = await armazenamento().ler(anexo.storage_path);

      resposta
        .header('Content-Type', anexo.mime_type)
        .header(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(anexo.nome_arquivo)}"`,
        )
        .header('Cache-Control', 'private, no-store')
        .send(conteudo);
    },
  );

  app.delete(
    '/api/anexos/:id',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      schema: {
        tags: ['anexos'],
        summary: 'Remove um anexo (compensação ou gestão)',
        params: z.object({ id: uuidSchema }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (pedido) => {
      const usuario = usuarioAtual(pedido);
      const anexo = await prisma.anexos.findUnique({ where: { id: pedido.params.id } });
      if (!anexo) throw new ErroHttp(404, 'nao_encontrado', 'Anexo não encontrado.');
      if (usuario.papel !== 'gestao' && anexo.criado_por !== usuario.id) {
        throw new ErroHttp(403, 'nao_autorizado', 'Sem permissão para remover este anexo.');
      }

      await armazenamento()
        .remover(anexo.storage_path)
        .catch(() => undefined);
      await prisma.anexos.delete({ where: { id: anexo.id } });
      return { ok: true as const };
    },
  );
};
