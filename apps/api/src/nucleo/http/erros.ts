export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroHttp';
  }
}

export function erroNaoAutenticado(mensagem = 'Sessão inválida ou expirada.') {
  return new ErroHttp(401, 'nao_autenticado', mensagem);
}

export function erroNaoAutorizado(mensagem = 'Você não tem permissão para esta ação.') {
  return new ErroHttp(403, 'nao_autorizado', mensagem);
}

export function erroNaoEncontrado(mensagem = 'Registro não encontrado.') {
  return new ErroHttp(404, 'nao_encontrado', mensagem);
}

export function erroValidacao(mensagem = 'Dados inválidos.') {
  return new ErroHttp(400, 'validacao', mensagem);
}
