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

export async function comprimirImagem(arquivo: File): Promise<ResultadoCompressao> {
  if (!arquivo.type.startsWith('image/')) {
    return {
      blob: arquivo,
      mimeType: arquivo.type,
      largura: 0,
      altura: 0,
      tamanhoOriginal: arquivo.size,
      tamanhoComprimido: arquivo.size,
    };
  }

  const bitmap = await createImageBitmap(arquivo);
  let { width, height } = bitmap;

  if (width > DIMENSAO_MAXIMA || height > DIMENSAO_MAXIMA) {
    const escala = Math.min(DIMENSAO_MAXIMA / width, DIMENSAO_MAXIMA / height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALIDADE_JPEG });

  if (blob.size >= arquivo.size) {
    return {
      blob: arquivo,
      mimeType: arquivo.type,
      largura: width,
      altura: height,
      tamanhoOriginal: arquivo.size,
      tamanhoComprimido: arquivo.size,
    };
  }

  return {
    blob,
    mimeType: 'image/jpeg',
    largura: width,
    altura: height,
    tamanhoOriginal: arquivo.size,
    tamanhoComprimido: blob.size,
  };
}
