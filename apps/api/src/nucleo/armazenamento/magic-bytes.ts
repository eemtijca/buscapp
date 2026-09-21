/** Assinaturas de bytes mágicos dos tipos aceitos em anexos. */
const ASSINATURAS: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

/** Tipo detectado pela assinatura do conteúdo, ou null quando não é um dos tipos aceitos. */
export function mimePorAssinatura(conteudo: Buffer): string | null {
  if (
    conteudo.length >= 12 &&
    conteudo.subarray(0, 4).toString('ascii') === 'RIFF' &&
    conteudo.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  for (const assinatura of ASSINATURAS) {
    const confere = assinatura.bytes.every((byte, indice) => conteudo[indice] === byte);
    if (confere && conteudo.length >= assinatura.bytes.length) return assinatura.mime;
  }

  return null;
}

/** Confere se o conteúdo real corresponde ao tipo declarado. */
export function assinaturaConfere(conteudo: Buffer, mimeDeclarado: string): boolean {
  return mimePorAssinatura(conteudo) === mimeDeclarado;
}
