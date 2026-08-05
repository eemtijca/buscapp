import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Segredo opcional para proteção do endpoint (definir como secret da função).
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const BUCKET = 'justificativas'

async function listarTodosOsObjetos(
  supabase: SupabaseClient,
  prefixo = '',
): Promise<string[]> {
  const caminhos: string[] = []
  const { data, error } = await supabase.storage.from(BUCKET).list(prefixo, {
    limit: 1000,
    offset: 0,
  })
  if (error) throw error

  for (const item of data ?? []) {
    const completo = prefixo ? `${prefixo}/${item.name}` : item.name
    if (item.id) {
      caminhos.push(completo)
    } else {
      caminhos.push(...(await listarTodosOsObjetos(supabase, completo)))
    }
  }
  return caminhos
}

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

  let removidos = 0
  let marcados = 0

  try {
    // 1) Anexos expirados e não processados: remove o objeto e marca o expurgo.
    const { data: expirados } = await supabase
      .from('anexos')
      .select('id, storage_path')
      .lt('expurgo_em', new Date().toISOString())
      .is('processado_em', null)
      .is('expurgado_em', null)

    for (const a of expirados ?? []) {
      const { error } = await supabase.storage.from(BUCKET).remove([a.storage_path])
      if (!error) removidos++
      const { error: up } = await supabase
        .from('anexos')
        .update({ expurgado_em: new Date().toISOString() })
        .eq('id', a.id)
      if (!up) marcados++
    }

    // 2) Objetos de storage sem linha correspondente (uploads órfãos).
    const { data: anexos } = await supabase.from('anexos').select('storage_path')
    const conhecidos = new Set((anexos ?? []).map((a) => a.storage_path))
    const objetos = await listarTodosOsObjetos(supabase)
    const orfaos = objetos.filter((p) => !conhecidos.has(p))
    if (orfaos.length) {
      await supabase.storage.from(BUCKET).remove(orfaos)
      removidos += orfaos.length
    }

    return new Response(
      JSON.stringify({ ok: true, removidos, marcados, orfaos: orfaos.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[limpar-anexos] Erro:', error)
    return new Response(
      JSON.stringify({ ok: false, error: 'Erro interno ao expurgar anexos.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
