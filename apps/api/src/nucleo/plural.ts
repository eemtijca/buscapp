// Auxiliar de pluralização: escolhe a forma correta para o número informado.
export function plural(quantidade: number, singular: string, formaPlural: string): string {
  return quantidade === 1 ? singular : formaPlural;
}
