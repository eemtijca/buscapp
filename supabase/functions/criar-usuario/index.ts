import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CorpoRequisicao {
  nome: string
  email: string
  papel: string
  telefone?: string
  cargo?: string
}

serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { data: perfil } = await supabaseClient
      .from('perfis')
      .select('papel')
      .eq('id', user.id)
      .single()

    if (!perfil || perfil.papel !== 'gestao') {
      return new Response(
        JSON.stringify({ error: 'Apenas gestão pode criar usuários.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { nome, email, papel, telefone, cargo }: CorpoRequisicao = await req.json()

    if (!nome || !email || !papel) {
      return new Response(
        JSON.stringify({ error: 'Nome, e-mail e papel são obrigatórios.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const senhaTemporaria = gerarSenhaTemporaria()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: novoUsuario, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senhaTemporaria,
      email_confirm: true,
      user_metadata: { nome, papel, email_verified: true },
    })

    if (createError) {
      console.error('[criar-usuario] Erro ao criar usuário:', createError.message)
      return new Response(
        JSON.stringify({ error: 'Este e-mail já está cadastrado no sistema.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const userId = novoUsuario.user.id

    const { error: perfilError } = await supabaseAdmin
      .from('perfis')
      .update({
        telefone: telefone ?? null,
        cargo: cargo ?? null,
        status: 'pendente',
      })
      .eq('id', userId)

    if (perfilError) {
      // Evita usuário autenticado órfão (sem perfil utilizável).
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      console.error('[criar-usuario] Erro ao finalizar perfil:', perfilError.message)
      return new Response(
        JSON.stringify({ error: 'Falha ao finalizar o perfil do usuário. Tente novamente.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    let codigo: string | null = null
    try {
      const { data: codigoData, error: codigoError } = await supabaseAdmin.rpc(
        'fn_gerar_codigo_redefinicao',
        {
          p_perfil_id: userId,
          p_criado_por: user.id,
        },
      )
      if (codigoError) throw codigoError
      codigo = codigoData as string | null
    } catch (e) {
      // Compensa a criação para não deixar usuário sem código de acesso.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      console.error('[criar-usuario] Erro ao gerar código automático:', e)
      return new Response(
        JSON.stringify({ error: 'Falha ao gerar o código de acesso. Usuário não criado.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        id: userId,
        email,
        codigo,
        senha_temporaria: senhaTemporaria,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[criar-usuario] Erro interno:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

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
