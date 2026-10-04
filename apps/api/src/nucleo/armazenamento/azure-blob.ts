import type { Readable } from 'node:stream';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type ContainerClient,
} from '@azure/storage-blob';
import { ambiente } from '../../ambiente.js';
import { normalizarChave, type Armazenamento } from './tipos.js';

/** Monta o cliente do Blob e reaproveita a credencial para gerar URLs assinadas. */
function criarClientes(): { container: ContainerClient; credencial: StorageSharedKeyCredential | null } {
  const nomeContainer = ambiente.AZURE_STORAGE_CONTAINER;
  if (!nomeContainer) {
    throw new Error('AZURE_STORAGE_CONTAINER é obrigatório quando STORAGE_DRIVER=azure-blob.');
  }

  if (ambiente.AZURE_STORAGE_CONNECTION_STRING) {
    const servico = BlobServiceClient.fromConnectionString(
      ambiente.AZURE_STORAGE_CONNECTION_STRING,
    );
    return {
      container: servico.getContainerClient(nomeContainer),
      credencial:
        servico.credential instanceof StorageSharedKeyCredential ? servico.credential : null,
    };
  }

  if (!ambiente.AZURE_STORAGE_ACCOUNT_URL) {
    throw new Error(
      'Informe AZURE_STORAGE_CONNECTION_STRING ou AZURE_STORAGE_ACCOUNT_URL quando STORAGE_DRIVER=azure-blob.',
    );
  }

  const servico = new BlobServiceClient(
    ambiente.AZURE_STORAGE_ACCOUNT_URL,
    new DefaultAzureCredential(),
  );
  return { container: servico.getContainerClient(nomeContainer), credencial: null };
}

export function criarArmazenamentoAzureBlob(): Armazenamento {
  const { container, credencial } = criarClientes();

  const blob = (chave: string) => container.getBlockBlobClient(normalizarChave(chave));

  const armazenamento: Armazenamento = {
    async salvar(chave, dados, mimeType) {
      await blob(chave).uploadData(dados, {
        blobHTTPHeaders: { blobContentType: mimeType },
      });
    },
    async ler(chave) {
      return blob(chave).downloadToBuffer();
    },
    async lerFluxo(chave) {
      const resposta = await blob(chave).download();
      if (!resposta.readableStreamBody) throw new Error('Objeto sem conteúdo.');
      return resposta.readableStreamBody as unknown as Readable;
    },
    async lerTrecho(chave, bytes) {
      const resposta = await blob(chave).download(0, Math.max(1, bytes));
      if (!resposta.readableStreamBody) throw new Error('Objeto sem conteúdo.');
      const pedacos: Buffer[] = [];
      for await (const pedaco of resposta.readableStreamBody) {
        pedacos.push(Buffer.from(pedaco as Buffer));
      }
      return Buffer.concat(pedacos);
    },
    async estatistica(chave) {
      const propriedades = await blob(chave).getProperties();
      return {
        tamanho: propriedades.contentLength ?? 0,
        mimeType: propriedades.contentType ?? null,
      };
    },
    async remover(chave) {
      await blob(chave).deleteIfExists();
    },
  };

  // A URL assinada exige chave compartilhada; com identidade gerenciada o
  // upload direto fica indisponível e o cliente usa o envio pela API.
  if (credencial) {
    const expiracao = ambiente.S3_UPLOAD_URL_EXPIRA_S;
    armazenamento.criarUrlUpload = async (chave, mimeType) => {
      const inicio = new Date(Date.now() - 60_000);
      const fim = new Date(Date.now() + expiracao * 1000);
      const sas = generateBlobSASQueryParameters(
        {
          containerName: container.containerName,
          blobName: normalizarChave(chave),
          permissions: BlobSASPermissions.parse('cw'),
          startsOn: inicio,
          expiresOn: fim,
          contentType: mimeType,
        },
        credencial,
      ).toString();
      return {
        url: `${blob(chave).url}?${sas}`,
        expiraEm: fim,
      };
    };
  }

  return armazenamento;
}
