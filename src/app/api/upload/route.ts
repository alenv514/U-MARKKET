import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createServiceClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'

// Verifica la firma binaria (magic bytes) del contenido para cada tipo permitido.
function matchesImageSignature(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mime === 'image/png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return buffer.length >= sig.length && sig.every((b, i) => buffer[i] === b)
  }
  if (mime === 'image/gif') {
    return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  }
  if (mime === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cookiesList = request.cookies.getAll().map(c => c.name)

    console.log('[DEBUG UPLOAD SERVER] Nueva petición de subida recibida:')
    console.log(' - Auth Header presente:', !!authHeader)
    console.log(' - Cookies recibidas (' + cookiesList.length + '):', cookiesList)

    let user = null
    let authMethod = 'none'
    let bearerError: string | null = null

    // 1. Intentar autenticar mediante Bearer token (móviles / PWA)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      try {
        const serviceClient = createServiceClient()
        const { data: authData, error: authErr } = await serviceClient.auth.getUser(token)
        if (!authErr && authData?.user) {
          user = authData.user
          authMethod = 'bearer_token'
          console.log(' - [AUTH OK] Usuario autenticado vía Bearer Token:', user.id, user.email)
        } else {
          bearerError = authErr?.message || 'Token inválido o expirado'
          console.warn(' - [AUTH WARN] Falló validación de Bearer Token:', bearerError)
        }
      } catch (err: unknown) {
        const e = err as Error
        bearerError = e?.message || 'Error en serviceClient'
        console.error(' - [AUTH ERROR] Error validando Bearer token:', e)
      }
    }

    // 2. Si no hay token o falló, intentar autenticar mediante cookies
    if (!user) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll() {},
          },
        }
      )
      const { data: cookieAuthData, error: cookieError } = await supabase.auth.getUser()
      if (cookieAuthData?.user) {
        user = cookieAuthData.user
        authMethod = 'cookies'
        console.log(' - [AUTH OK] Usuario autenticado vía Cookies:', user.id, user.email)
      } else {
        console.warn(' - [AUTH WARN] Falló autenticación vía cookies:', cookieError?.message || 'Sin cookies válidas')
      }
    }

    if (!user) {
      console.error('[DEBUG UPLOAD SERVER] ❌ Autenticación rechazada en /api/upload')
      return NextResponse.json({
        error: `No autorizado. Tu sesión ha expirado o debes iniciar sesión nuevamente. (Método: ${authMethod}, Error Bearer: ${bearerError || 'ninguno'}, Cookies: [${cookiesList.join(', ')}])`,
        debug: {
          hasBearer: !!authHeader,
          bearerError,
          cookiesCount: cookiesList.length,
          cookiesFound: cookiesList,
        }
      }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'listings'
    console.log(`[DEBUG UPLOAD SERVER] Usuario: ${user.email} -> Subiendo a carpeta: "${folder}", archivo: "${file?.name}" (${file?.size} bytes)`)

    if (folder !== 'listings' && folder !== 'avatars' && folder !== 'credentials') {
      return NextResponse.json({ error: 'Carpeta no válida' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const mime = file.type.toLowerCase()
    const extByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    if (!extByMime[mime]) {
      return NextResponse.json({ error: 'Solo se permiten imágenes válidas (JPG, PNG, WEBP, GIF)' }, { status: 400 })
    }

    // Validar tamaño máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen excede el tamaño máximo permitido (10MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Verificar que el contenido real corresponde a una imagen (evita falsear el MIME)
    if (!matchesImageSignature(buffer, mime)) {
      return NextResponse.json({ error: 'El archivo no es una imagen válida (magic bytes mismatch)' }, { status: 400 })
    }

    const fileName = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extByMime[mime]}`
    console.log(`[DEBUG UPLOAD SERVER] Subiendo objeto a Cloudflare R2: Bucket=${R2_BUCKET}, Key=${fileName}`)

    // Subir a Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: mime,
    })

    await r2.send(uploadCommand)

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${fileName}`
    console.log(`[DEBUG UPLOAD SERVER] ✅ Subida a R2 exitosa: ${publicUrl}`)

    return NextResponse.json({ success: true, url: publicUrl, fileName })
  } catch (err: unknown) {
    const error = err as Error
    console.error('[DEBUG UPLOAD SERVER] ❌ Excepción no controlada en /api/upload:', error)
    return NextResponse.json({ error: error?.message || 'Error al subir la imagen' }, { status: 500 })
  }
}
