import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Segredo opcional para proteção do endpoint (definir como secret da função).
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  const segredo = req.headers.get('cron-secret') ?? ''
  if (CRON_SECRET && segredo !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // Lê a retenção configurada (padrão 30 dias)
    const { data: cfg } = await supabase
      .from('configuracoes_sistema')
      .select('dias_retencao_codigos')
      .eq('id', 1)
      .single()
    const dias = cfg?.dias_retencao_codigos ?? 30

    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

    // Remove códigos usados ou expirados com mais de `dias` dias.
    // Códigos ainda ativos (não usados e não expirados) são preservados.
    const { data: removidos, error } = await supabase
      .from('codigos_redefinicao')
      .delete()
      .or(`usado_em.lt.${limite},expira_em.lt.${limite}`)
      .select('id')

    if (error) throw error

    return new Response(
      JSON.stringify({ ok: true, removidos: removidos?.length ?? 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[limpar-codigos] Erro:', error)
    return new Response(
      JSON.stringify({ ok: false, error: 'Erro interno ao limpar códigos.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
