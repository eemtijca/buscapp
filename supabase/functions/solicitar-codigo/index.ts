import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    try {
      const { email } = await req.json()

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json(
          { error: 'Informe um e-mail válido.' },
          { status: 400 },
        )
      }

      const { error } = await ctx.supabaseAdmin.rpc('fn_solicitar_codigo_redefinicao', {
        p_email: email,
      })

      if (error) {
        console.error('[solicitar-codigo] Erro ao processar:', error.message)
      }

      return Response.json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, a administração será notificada.',
      })
    } catch (error) {
      console.error('[solicitar-codigo] Erro interno:', error)
      return Response.json(
        { error: 'Erro interno do servidor. Tente novamente.' },
        { status: 500 },
      )
    }
  }),
}
