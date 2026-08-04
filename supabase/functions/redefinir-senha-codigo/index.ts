import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CorpoRequisicao {
  email: string
  codigo: string
  novaSenha: string
}

serve(async (req: Request) => {
  try {
    const { email, codigo, novaSenha }: CorpoRequisicao = await req.json()

    if (!email || !codigo || !novaSenha) {
      return new Response(
        JSON.stringify({ error: 'E-mail, código e nova senha são obrigatórios.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (novaSenha.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 8 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: codigoData, error: codigoError } = await supabaseAdmin
      .from('codigos_redefinicao')
      .select('*')
      .eq('email', email)
      .eq('codigo', codigo)
      .is('usado_em', null)
      .single()

    if (codigoError || !codigoData) {
      return new Response(
        JSON.stringify({ error: 'Código inválido. Verifique o código informado.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (new Date(codigoData.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Código expirado. Solicite um novo código com a administração.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Consome o código de forma atômica ANTES de alterar a senha, para impedir
    // a reutilização (replay) do mesmo código em requisições concorrentes.
    const { data: marcado, error: marcarError } = await supabaseAdmin
      .from('codigos_redefinicao')
      .update({ usado_em: new Date().toISOString() })
      .eq('id', codigoData.id)
      .is('usado_em', null)
      .select('id')

    if (marcarError || !marcado || marcado.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Código já utilizado. Solicite um novo código.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      codigoData.perfil_id,
      { password: novaSenha },
    )

    if (updateError) {
      // Reverte o consumo do código para permitir nova tentativa.
      await supabaseAdmin
        .from('codigos_redefinicao')
        .update({ usado_em: null })
        .eq('id', codigoData.id)
        .is('usado_em', null)
      console.error('[redefinir-senha-codigo] Erro ao atualizar senha:', updateError.message)
      return new Response(
        JSON.stringify({ error: 'Erro ao redefinir senha. Tente novamente.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
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

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[redefinir-senha-codigo] Erro interno:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
