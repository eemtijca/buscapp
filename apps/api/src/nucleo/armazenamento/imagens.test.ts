import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ehImagem, processarImagem } from './imagens.js';

async function imagemComExif(largura = 800, altura = 600): Promise<Buffer> {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: 'BuscApp', Software: 'Teste EXIF' } } })
    .toBuffer();
}

describe('processamento de imagens no servidor', () => {
  it('remove os metadados EXIF ao regravar', async () => {
    const original = await imagemComExif();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const processada = await processarImagem(original, 'image/jpeg');
    expect(processada).not.toBeNull();
    expect((await sharp(processada!).metadata()).exif).toBeUndefined();
  });

  it('redimensiona até 1600 px sem ampliar imagens menores', async () => {
    const grande = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: '#333' },
    })
      .jpeg()
      .toBuffer();

    const reduzida = await processarImagem(grande, 'image/jpeg');
    const metadados = await sharp(reduzida!).metadata();
    expect(metadados.width).toBe(1600);
    expect(metadados.height).toBe(533);

    const pequena = await imagemComExif(320, 240);
    const mantida = await processarImagem(pequena, 'image/jpeg');
    expect((await sharp(mantida!).metadata()).width).toBe(320);
  });

  it('devolve null para conteúdo inválido e para tipos não processáveis', async () => {
    expect(await processarImagem(Buffer.from('não é imagem'), 'image/jpeg')).toBeNull();
    expect(await processarImagem(Buffer.from('%PDF-1.7'), 'application/pdf')).toBeNull();
    expect(ehImagem('application/pdf')).toBe(false);
  });
});
