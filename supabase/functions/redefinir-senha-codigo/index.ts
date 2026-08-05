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

      const { data: codigoData, error: codigoError } = await supabaseAdmin
        .from('codigos_redefinicao')
        .select('*')
        .eq('email', email)
        .eq('codigo', codigo)
        .is('usado_em', null)
        .single()

      if (codigoError || !codigoData) {
        return Response.json(
          { error: 'Código inválido. Verifique o código informado.' },
          { status: 400 },
        )
      }

      if (new Date(codigoData.expira_em) < new Date()) {
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
