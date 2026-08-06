interface ErroTraduzido {
  mensagem: string;
  tempo?: number;
}

function extrairDadosGoTrue(mensagem: string): { code: string; submessage: string } | null {
  try {
    const parsed = JSON.parse(mensagem);
    if (parsed.code && parsed.message) {
      return { code: parsed.code, submessage: parsed.message };
    }
  } catch {
    // não é JSON
  }
  return null;
}

function extrairSegundos(texto: string): number | undefined {
  const english = /after\s+(\d+)\s+seconds/.exec(texto);
  if (english?.[1]) return Number.parseInt(english[1], 10);
  const portuguese = /após\s+(\d+)\s+segundos/.exec(texto);
  if (portuguese?.[1]) return Number.parseInt(portuguese[1], 10);
  return undefined;
}

export function traduzirErro(erroDesconhecido: unknown): ErroTraduzido {
  const mensagemOriginal =
    erroDesconhecido instanceof Error ? erroDesconhecido.message : String(erroDesconhecido);

  const gotrue = extrairDadosGoTrue(mensagemOriginal);

  if (gotrue) {
    if (gotrue.code === 'over_email_send_rate_limit') {
      const segundos = extrairSegundos(gotrue.submessage);
      if (segundos !== undefined) {
        return {
          mensagem: `Muitas solicitações. Tente novamente em ${segundos} segundos.`,
          tempo: segundos,
        };
      }
      if (gotrue.submessage.toLowerCase().includes('rate limit exceeded')) {
        return { mensagem: 'Limite de envio de e-mails atingido. Tente novamente em 1 hora.' };
      }
      return { mensagem: 'Muitas solicitações de e-mail. Aguarde um momento e tente novamente.' };
    }

    if (gotrue.code === 'over_request_rate_limit') {
      return {
        mensagem: 'Muitas requisições deste endereço. Aguarde alguns minutos e tente novamente.',
      };
    }
  }

  // --- Erros legados (string direta) ---

  if (mensagemOriginal.includes('Invalid login credentials')) {
    return { mensagem: 'E-mail ou senha incorretos.' };
  }

  if (mensagemOriginal.includes('Email not confirmed')) {
    return { mensagem: 'E-mail ainda não confirmado. Verifique sua caixa de entrada.' };
  }

  if (mensagemOriginal.includes('Too many requests')) {
    return { mensagem: 'Muitas tentativas seguidas. Aguarde um momento e tente novamente.' };
  }

  if (mensagemOriginal.includes('Auth session missing')) {
    return { mensagem: 'Sessão expirada. Faça login novamente.' };
  }

  if (mensagemOriginal.includes('Password should be')) {
    return { mensagem: 'A senha não atende aos requisitos mínimos de segurança.' };
  }

  if (
    mensagemOriginal.includes('NetworkError') ||
    mensagemOriginal.includes('TypeError') ||
    mensagemOriginal.includes('Failed to fetch')
  ) {
    return {
      mensagem: 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.',
    };
  }

  if (
    mensagemOriginal.includes('Codigo invalido') ||
    mensagemOriginal.includes('Código inválido')
  ) {
    return { mensagem: 'Código inválido. Verifique o código informado.' };
  }

  if (
    mensagemOriginal.includes('Codigo expirado') ||
    mensagemOriginal.includes('Código expirado')
  ) {
    return { mensagem: 'Código expirado. Solicite um novo código com a administração.' };
  }

  if (
    mensagemOriginal.includes('Codigo ja utilizado') ||
    mensagemOriginal.includes('Código já utilizado')
  ) {
    return { mensagem: 'Código já utilizado. Solicite um novo código.' };
  }

  if (mensagemOriginal.includes('Muitas tentativas')) {
    return { mensagem: 'Muitas tentativas. Solicite um novo código com a administração.' };
  }

  if (
    mensagemOriginal.includes('Cadastro ja existe') ||
    mensagemOriginal.includes('já está cadastrado') ||
    mensagemOriginal.includes('ja esta cadastrado') ||
    mensagemOriginal.includes('already exists') ||
    mensagemOriginal.includes('duplicate key')
  ) {
    return { mensagem: 'Este e-mail já está cadastrado no sistema.' };
  }

  return { mensagem: 'Ocorreu um erro inesperado. Tente novamente.' };
}
