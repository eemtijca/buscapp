export interface ResultadoCompressao {
  blob: Blob;
  mimeType: string;
  largura: number;
  altura: number;
  tamanhoOriginal: number;
  tamanhoComprimido: number;
}

const DIMENSAO_MAXIMA = 1600;
const QUALIDADE_JPEG = 0.6;

function semCompressao(arquivo: File, largura = 0, altura = 0): ResultadoCompressao {
  return {
    blob: arquivo,
    mimeType: arquivo.type,
    largura,
    altura,
    tamanhoOriginal: arquivo.size,
    tamanhoComprimido: arquivo.size,
  };
}

/** Decodifica a imagem com `createImageBitmap` ou, no fallback, com um `<img>` e `objectURL`. */
async function decodificar(arquivo: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      /* cai para o fallback */
    }
  }

  return new Promise((resolver) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      resolver(null);
    };
    imagem.src = url;
  });
}

/** Desenha em canvas e devolve um JPEG; usa OffscreenCanvas quando disponível. */
async function converterParaJpeg(
  origem: ImageBitmap | HTMLImageElement,
  largura: number,
  altura: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(largura, altura);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(origem, 0, 0, largura, altura);
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALIDADE_JPEG });
    } catch {
      /* cai para o canvas comum */
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(origem, 0, 0, largura, altura);

  return new Promise((resolver) => {
    canvas.toBlob((blob) => resolver(blob), 'image/jpeg', QUALIDADE_JPEG);
  });
}

export async function comprimirImagem(arquivo: File): Promise<ResultadoCompressao> {
  if (!arquivo.type.startsWith('image/')) return semCompressao(arquivo);

  const origem = await decodificar(arquivo);
  if (!origem) return semCompressao(arquivo);

  const larguraOriginal = origem.width;
  const alturaOriginal = origem.height;
  let width = larguraOriginal;
  let height = alturaOriginal;

  if (width > DIMENSAO_MAXIMA || height > DIMENSAO_MAXIMA) {
    const escala = Math.min(DIMENSAO_MAXIMA / width, DIMENSAO_MAXIMA / height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const blob = await converterParaJpeg(origem, width, height);
  if (origem instanceof ImageBitmap) origem.close();

  if (!blob || blob.size >= arquivo.size) return semCompressao(arquivo, width, height);

  return {
    blob,
    mimeType: 'image/jpeg',
    largura: width,
    altura: height,
    tamanhoOriginal: arquivo.size,
    tamanhoComprimido: blob.size,
  };
}
