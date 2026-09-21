import sharp from 'sharp';
import { ambiente } from '../../ambiente.js';

/** Lado máximo, em pixels, depois do redimensionamento proporcional. */
const LADO_MAXIMO = 1600;

/** Limite defensivo de pixels de entrada (evita decompression bomb). */
const PIXELS_MAXIMOS = 40_000_000;

/** Imagens processáveis no servidor; PDFs e demais tipos passam intactos. */
export const MIMES_IMAGEM: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

export function ehImagem(mimeType: string): boolean {
  return MIMES_IMAGEM.includes(mimeType);
}

/**
 * Redimensiona (até 1600 px), aplica a orientação do EXIF e regrava a imagem
 * sem metadados — inclusive geolocalização. Devolve `null` quando o
 * processamento está desligado, o tipo não é imagem ou o conteúdo não pôde ser
 * interpretado; nesse caso o chamador mantém o original.
 */
export async function processarImagem(conteudo: Buffer, mimeType: string): Promise<Buffer | null> {
  if (!ambiente.PROCESSAR_IMAGENS || !ehImagem(mimeType)) return null;

  try {
    const imagem = sharp(conteudo, { failOn: 'error', limitInputPixels: PIXELS_MAXIMOS })
      .rotate()
      .resize({
        width: LADO_MAXIMO,
        height: LADO_MAXIMO,
        fit: 'inside',
        withoutEnlargement: true,
      });

    if (mimeType === 'image/jpeg') return await imagem.jpeg({ quality: 82 }).toBuffer();
    if (mimeType === 'image/png') return await imagem.png({ compressionLevel: 9 }).toBuffer();
    return await imagem.webp({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}
