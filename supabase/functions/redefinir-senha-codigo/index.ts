import { withSupabase } from 'npm:@supabase/server@^1'

interface CorpoRequisicao {
  email: string
  codigo: string
  novaSenha: string
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    try {
      const { supabaseAdmin } = ctx
      const { email, codigo, novaSenha }: CorpoRequisicao = await req.json()

      if (!email || !codigo || !novaSenha) {
        return Response.json(
          { error: 'E-mail, código e nova senha são obrigatórios.' },
          { status: 400 },
        )
      }

      if (novaSenha.length < 8) {
        return Response.json(
          { error: 'A senha deve ter no mínimo 8 caracteres.' },
          { status: 400 },
        )
      }

      // Anti força bruta: e-mail bloqueado por excesso de tentativas falhas
      const { data: bloqueado } = await supabaseAdmin.rpc('fn_codigo_email_bloqueado', {
        p_email: email,
      })
      if (bloqueado === true) {
        return Response.json(
          {
            error:
              'Muitas tentativas com este e-mail. Solicite um novo código com a administração.',
          },
          { status: 400 },
        )
      }

      const registrarTentativa = async () => {
        await supabaseAdmin.rpc('fn_registrar_tentativa_email', { p_email: email })
      }

      const { data: codigoData, error: codigoError } = await supabaseAdmin
        .from('codigos_redefinicao')
        .select('*')
        .eq('email', email)
        .eq('codigo', codigo)
        .is('usado_em', null)
        .single()

      if (codigoError || !codigoData) {
        await registrarTentativa()
        return Response.json(
          { error: 'Código inválido. Verifique o código informado.' },
          { status: 400 },
        )
      }

      if (new Date(codigoData.expira_em) < new Date()) {
        await registrarTentativa()
        return Response.json(
          { error: 'Código expirado. Solicite um novo código com a administração.' },
          { status: 400 },
        )
      }

      // Consome o código de forma atômica antes de alterar a senha, para impedir
      // a reutilização (replay) do mesmo código em requisições concorrentes
      const { data: marcado, error: marcarError } = await supabaseAdmin
        .from('codigos_redefinicao')
        .update({ usado_em: new Date().toISOString() })
        .eq('id', codigoData.id)
        .is('usado_em', null)
        .select('id')

      if (marcarError || !marcado || marcado.length === 0) {
        await registrarTentativa()
        return Response.json(
          { error: 'Código já utilizado. Solicite um novo código.' },
          { status: 400 },
        )
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        codigoData.perfil_id,
        { password: novaSenha },
      )

      if (updateError) {
        // Reverte o consumo do código para permitir nova tentativa
        await supabaseAdmin
          .from('codigos_redefinicao')
          .update({ usado_em: null })
          .eq('id', codigoData.id)
          .is('usado_em', null)
        console.error('[redefinir-senha-codigo] Erro ao atualizar senha:', updateError.message)
        return Response.json(
          { error: 'Erro ao redefinir senha. Tente novamente.' },
          { status: 500 },
        )
      }

      const { error: ativarError } = await supabaseAdmin
        .from('perfis')
        .update({ status: 'ativo' })
        .eq('id', codigoData.perfil_id)
        .eq('status', 'pendente')

      if (ativarError) {
        console.error('[redefinir-senha-codigo] Erro ao ativar perfil:', ativarError.message)
      }

      await supabaseAdmin.rpc('fn_limpar_tentativas_email', { p_email: email })

      // Auditoria LGPD do uso do código
      await supabaseAdmin.from('auditoria').insert({
        usuario_id: codigoData.perfil_id,
        acao: 'USAR_CODIGO',
        entidade: 'codigos_redefinicao',
        entidade_id: codigoData.id,
        dados_novos: { email },
      })

      return Response.json({ success: true })
    } catch (error) {
      console.error('[redefinir-senha-codigo] Erro interno:', error)
      return Response.json(
        { error: 'Erro interno do servidor. Tente novamente.' },
        { status: 500 },
      )
    }
  }),
}
