import {
  confirmacaoUploadAnexoSchema,
  MIMES_ANEXO,
  solicitacaoUploadAnexoSchema,
  uuidSchema,
} from '@buscapp/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ambiente } from '../../ambiente.js';
import { armazenamento, nomeSeguro, normalizarChave } from '../../nucleo/armazenamento/index.js';
import { autenticar, exigirPapel, usuarioAtual } from '../../nucleo/autenticacao/middleware.js';
import { prisma } from '../../nucleo/banco/cliente.js';
import { ErroHttp } from '../../nucleo/http/erros.js';
import { garantirAcessoAnexo, gerarChaveAnexo, paraAnexo } from './anexos.servico.js';

const TIPOS_PERMITIDOS: readonly string[] = MIMES_ANEXO;
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

function limiteUploadDireto(): string {
  return `${Math.round(ambiente.UPLOAD_DIRETO_MAX_BYTES / (1024 * 1024))} MB`;
}

export const rotasAnexos: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/api/anexos/upload',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
      schema: {
        tags: ['anexos'],
        summary: 'Gera URL pré-assinada para envio direto de um anexo ao provedor',
        body: solicitacaoUploadAnexoSchema,
      },
    },
    async (pedido) => {
      const dados = pedido.body;
      if (dados.tamanho_bytes > ambiente.UPLOAD_DIRETO_MAX_BYTES) {
        throw new ErroHttp(
          413,
          'arquivo_grande',
          `O arquivo excede o limite de ${limiteUploadDireto()}.`,
        );
      }

      const armazenamentoAtual = armazenamento();
      if (!armazenamentoAtual.criarUrlUpload) {
        throw new ErroHttp(
          400,
          'upload_direto_indisponivel',
          'O envio direto não está disponível neste ambiente.',
        );
      }

      const usuario = usuarioAtual(pedido);
      const chave = normalizarChave(gerarChaveAnexo(usuario.id, nomeSeguro(dados.nome_arquivo)));
      const { url, expiraEm } = await armazenamentoAtual.criarUrlUpload(chave, dados.mime_type);

      return { upload: { chave, url, expira_em: expiraEm.toISOString() } };
    },
  );

  app.post(
    '/api/anexos/confirmar',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
      schema: {
        tags: ['anexos'],
        summary: 'Confirma um anexo enviado direto ao provedor e registra os metadados',
        body: confirmacaoUploadAnexoSchema,
      },
    },
    async (pedido, resposta) => {
      const dados = pedido.body;
      const chave = normalizarChave(dados.chave);
      if (!chave.startsWith(`${usuarioAtual(pedido).id}/`)) {
        throw new ErroHttp(403, 'nao_autorizado', 'Chave de anexo inválida.');
      }

      const existente = await prisma.anexos.findFirst({ where: { storage_path: chave } });
      if (existente) return { anexo: paraAnexo(existente) };

      const armazenamentoAtual = armazenamento();
      if (!armazenamentoAtual.estatistica) {
        throw new ErroHttp(
          400,
          'upload_direto_indisponivel',
          'O envio direto não está disponível neste ambiente.',
        );
      }

      const info = await armazenamentoAtual.estatistica(chave).catch(() => null);
      if (!info || info.tamanho <= 0) {
        throw new ErroHttp(400, 'arquivo_ausente', 'O arquivo ainda não foi enviado.');
      }
      if (info.tamanho > ambiente.UPLOAD_DIRETO_MAX_BYTES) {
        throw new ErroHttp(
          413,
          'arquivo_grande',
          `O arquivo excede o limite de ${limiteUploadDireto()}.`,
        );
      }
      if (info.tamanho !== dados.tamanho_bytes) {
        throw new ErroHttp(400, 'arquivo_divergente', 'O tamanho do arquivo enviado não confere.');
      }
      if (info.mimeType && info.mimeType !== dados.mime_type) {
        throw new ErroHttp(400, 'tipo_invalido', 'O tipo do arquivo enviado não confere.');
      }

      const anexo = await prisma.anexos.create({
        data: {
          storage_path: chave,
          nome_arquivo: dados.nome_arquivo,
          mime_type: dados.mime_type,
          tamanho_bytes: info.tamanho,
          criado_por: usuarioAtual(pedido).id,
        },
      });

      resposta.status(201);
      return { anexo: paraAnexo(anexo) };
    },
  );

  app.post(
    '/api/anexos',
    {
      preHandler: [autenticar, exigirPapel('gestao', 'responsavel', 'professor')],
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
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
      const fluxo = await armazenamento().lerFluxo(anexo.storage_path);

      return resposta
        .header('Content-Type', anexo.mime_type)
        .header('Content-Length', String(anexo.tamanho_bytes))
        .header(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(anexo.nome_arquivo)}"`,
        )
        .header('Cache-Control', 'private, no-store')
        .send(fluxo);
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
