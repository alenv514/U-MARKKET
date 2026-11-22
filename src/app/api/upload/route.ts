import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createServiceClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'
import { createRateLimiter } from '@/lib/rate-limit'

const isIpUploadRateLimited = createRateLimiter(120, 60_000)
const isUserUploadRateLimited = createRateLimiter(20, 60_000)

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'

    if (isIpUploadRateLimited(`upload_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiadas subidas desde esta red. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const serviceClient = createServiceClient()
    let user = null

    // 1. Intentar autenticar mediante Bearer token (móviles / PWA)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      if (token) {
        const { data: authData, error: authErr } = await serviceClient.auth.getUser(token)
        if (!authErr && authData?.user) {
          user = authData.user
        }
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
      const { data: cookieAuthData } = await supabase.auth.getUser()
      if (cookieAuthData?.user) {
        user = cookieAuthData.user
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado. Tu sesión ha expirado o debes iniciar sesión nuevamente.' },
        { status: 401 }
      )
    }

    if (isUserUploadRateLimited(`upload_user:${user.id}`)) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de subidas por minuto. Intenta de nuevo pronto.' },
        { status: 429 }
      )
    }

    // Verificar que la cuenta del usuario siga activa
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_active === false) {
      return NextResponse.json(
        { error: 'Tu cuenta está suspendida y no puede subir archivos.' },
        { status: 403 }
      )
    }

    if (!R2_PUBLIC_URL) {
      return NextResponse.json({ error: 'Servicio de almacenamiento no configurado' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'listings'

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
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }

    const fileName = `${folder}/${user.id}/${Date.now()}-${randomUUID()}.${extByMime[mime]}`

    // Subir a Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: mime,
    })

    await r2.send(uploadCommand)

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${fileName}`

    return NextResponse.json({ success: true, url: publicUrl, fileName })
  } catch (err: unknown) {
    console.error('Error en /api/upload:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
