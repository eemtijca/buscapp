import { createClient } from 'npm:@supabase/supabase-js@2.110.0'
import {
  ImageMagick,
  initializeImageMagick,
} from 'npm:@imagemagick/magick-wasm@0.0.30'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const wasmBytes = await Deno.readFile(
  new URL('magick.wasm', import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30')),
)
await initializeImageMagick(wasmBytes)

interface Payload {
  storagePath: string
  mimeType: string
  anexoId: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { storagePath, mimeType, anexoId } = payload
  if (!storagePath || !anexoId) {
    return new Response('Missing required fields: storagePath, anexoId', { status: 400 })
  }

  try {
    const bucket = storagePath.split('/')[0]
    const path = storagePath.split('/').slice(1).join('/')

    const { data: fileData, error: dlError } = await supabase.storage
      .from(bucket)
      .download(path)

    if (dlError || !fileData) {
      console.error('Download failed:', dlError?.message ?? 'no data')
      throw new Error('Download failed')
    }

    const originalBytes = new Uint8Array(await fileData.arrayBuffer())
    let processedBytes: Uint8Array
    let resultMimeType = mimeType
    const originalSize = originalBytes.length

    if (mimeType.startsWith('image/')) {
      try {
        const MAX_DIM = 2000
        processedBytes = ImageMagick.read(originalBytes, (img) => {
          const w = img.width
          const h = img.height
          if (w > MAX_DIM || h > MAX_DIM) {
            const scale = Math.min(MAX_DIM / w, MAX_DIM / h)
            img.resize(Math.round(w * scale), Math.round(h * scale))
          }
          img.quality = 50
          return img.write((data) => data)
        })
        resultMimeType = 'image/jpeg'
      } catch (imgErr) {
        console.error('Image processing error, storing original:', imgErr)
        processedBytes = originalBytes
      }
    } else if (mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(originalBytes, {
          ignoreEncryption: true,
        })
        processedBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: 100,
        })
      } catch (pdfErr) {
        console.error('PDF processing error, storing original:', pdfErr)
        processedBytes = originalBytes
      }
    } else {
      processedBytes = originalBytes
    }

    const { error: upError } = await supabase.storage
      .from(bucket)
      .update(path, processedBytes, {
        contentType: resultMimeType,
        upsert: true,
      })

    if (upError) {
      console.error('Upload failed:', upError.message)
      throw new Error('Upload failed')
    }

    const compressedSize = processedBytes.length
    const { error: dbError } = await supabase
      .from('anexos')
      .update({
        tamanho_bytes: compressedSize,
        mime_type: resultMimeType,
        processado_em: new Date().toISOString(),
      })
      .eq('id', anexoId)

    if (dbError) {
      console.error('Failed to update anexos metadata:', dbError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        anexoId,
        originalSize,
        compressedSize,
        savings: Math.round((1 - compressedSize / originalSize) * 100),
        resultMimeType,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('processar-anexo error:', err)
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar anexo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
