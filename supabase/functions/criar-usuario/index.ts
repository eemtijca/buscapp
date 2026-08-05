import { withSupabase } from 'npm:@supabase/server@^1'

interface CorpoRequisicao {
  nome: string
  email: string
  papel: string
  telefone?: string
  cargo?: string
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const {
        data: { user },
      } = await ctx.supabase.auth.getUser()
      if (!user) {
        return Response.json(
          { error: 'Token inválido.' },
          { status: 401 },
        )
      }

      const { data: perfil } = await ctx.supabase
        .from('perfis')
        .select('papel')
        .eq('id', user.id)
        .single()

      if (!perfil || perfil.papel !== 'gestao') {
        return Response.json(
          { error: 'Apenas gestão pode criar usuários.' },
          { status: 403 },
        )
      }

      const { nome, email, papel, telefone, cargo }: CorpoRequisicao = await req.json()

      if (!nome || !email || !papel) {
        return Response.json(
          { error: 'Nome, e-mail e papel são obrigatórios.' },
          { status: 400 },
        )
      }

      const senhaTemporaria = gerarSenhaTemporaria()

      const { data: novoUsuario, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password: senhaTemporaria,
        email_confirm: true,
        user_metadata: { nome, papel, email_verified: true },
      })

      if (createError) {
        console.error('[criar-usuario] Erro ao criar usuário:', createError.message)
        return Response.json(
          { error: 'Este e-mail já está cadastrado no sistema.' },
          { status: 400 },
        )
      }

      const userId = novoUsuario.user.id

      const { error: perfilError } = await ctx.supabaseAdmin
        .from('perfis')
        .update({
          telefone: telefone ?? null,
          cargo: cargo ?? null,
          status: 'pendente',
        })
        .eq('id', userId)

      if (perfilError) {
        // Evita usuário autenticado órfão (sem perfil utilizável)
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
        console.error('[criar-usuario] Erro ao finalizar perfil:', perfilError.message)
        return Response.json(
          { error: 'Falha ao finalizar o perfil do usuário. Tente novamente.' },
          { status: 500 },
        )
      }

      let codigo: string | null = null
      try {
        const { data: codigoData, error: codigoError } = await ctx.supabaseAdmin.rpc(
          'fn_gerar_codigo_redefinicao',
          {
            p_perfil_id: userId,
            p_criado_por: user.id,
          },
        )
        if (codigoError) throw codigoError
        codigo = codigoData as string | null
      } catch (e) {
        // Compensa a criação para não deixar usuário sem código de acesso
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
        console.error('[criar-usuario] Erro ao gerar código automático:', e)
        return Response.json(
          { error: 'Falha ao gerar o código de acesso. Usuário não criado.' },
          { status: 500 },
        )
      }

      return Response.json({
        id: userId,
        email,
        codigo,
        senha_temporaria: senhaTemporaria,
      })
    } catch (error) {
      console.error('[criar-usuario] Erro interno:', error)
      return Response.json(
        { error: 'Erro interno do servidor. Tente novamente.' },
        { status: 500 },
      )
    }
  }),
}

function gerarSenhaTemporaria(): string {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const minusculas = 'abcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const especiais = '!@#$%&'

  const getRandom = (chars: string) => chars.charAt(Math.floor(Math.random() * chars.length))

  const senha =
    getRandom(maiusculas) +
    getRandom(minusculas) +
    getRandom(numeros) +
    getRandom(especiais) +
    Array.from({ length: 6 }, () => getRandom(maiusculas + minusculas + numeros)).join('')

  return senha.split('').sort(() => Math.random() - 0.5).join('')
}
