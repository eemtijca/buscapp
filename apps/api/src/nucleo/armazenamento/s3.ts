import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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
    async remover(chave) {
      await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: normalizarChave(chave) }));
    },
  };
}
