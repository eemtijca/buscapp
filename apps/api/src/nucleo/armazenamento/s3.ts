import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ambiente } from '../../ambiente.js';
import { normalizarChave, type Armazenamento } from './tipos.js';

export function criarArmazenamentoS3(): Armazenamento {
  const bucket = ambiente.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET é obrigatória quando STORAGE_DRIVER=s3.');

  const cliente = new S3Client({
    region: ambiente.S3_REGION,
    forcePathStyle: true,
    ...(ambiente.S3_ENDPOINT ? { endpoint: ambiente.S3_ENDPOINT } : {}),
    ...(ambiente.S3_ACCESS_KEY_ID && ambiente.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: ambiente.S3_ACCESS_KEY_ID,
            secretAccessKey: ambiente.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  return {
    async salvar(chave, dados, mimeType) {
      await cliente.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: normalizarChave(chave),
          Body: dados,
          ContentType: mimeType,
        }),
      );
    },
    async ler(chave) {
      const resposta = await cliente.send(
        new GetObjectCommand({ Bucket: bucket, Key: normalizarChave(chave) }),
      );
      const bytes = await resposta.Body?.transformToByteArray();
      if (!bytes) throw new Error('Objeto sem conteúdo.');
      return Buffer.from(bytes);
    },
    async lerFluxo(chave) {
      const resposta = await cliente.send(
        new GetObjectCommand({ Bucket: bucket, Key: normalizarChave(chave) }),
      );
      if (!resposta.Body) throw new Error('Objeto sem conteúdo.');
      return resposta.Body as unknown as Readable;
    },
    async criarUrlUpload(chave, mimeType) {
      const url = await getSignedUrl(
        cliente,
        new PutObjectCommand({
          Bucket: bucket,
          Key: normalizarChave(chave),
          ContentType: mimeType,
        }),
        { expiresIn: ambiente.S3_UPLOAD_URL_EXPIRA_S },
      );
      return { url, expiraEm: new Date(Date.now() + ambiente.S3_UPLOAD_URL_EXPIRA_S * 1000) };
    },
    async estatistica(chave) {
      const resposta = await cliente.send(
        new HeadObjectCommand({ Bucket: bucket, Key: normalizarChave(chave) }),
      );
      return {
        tamanho: resposta.ContentLength ?? 0,
        mimeType: resposta.ContentType ?? null,
      };
    },
    async remover(chave) {
      await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: normalizarChave(chave) }));
    },
  };
}
