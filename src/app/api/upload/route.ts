import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { PutObjectCommand } from '@aws-sdk/client-s3'
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
    // Autenticación leyendo las cookies del request directamente (mismo mecanismo
    // que el middleware proxy, que sí funciona en móvil). En un route handler es
    // más fiable usar request.cookies que `cookies()` de next/headers.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {}, // no necesitamos escribir cookies aquí
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Tu sesión ha expirado o debes iniciar sesión nuevamente.' }, { status: 401 })
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

    const fileName = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extByMime[mime]}`

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
    const error = err as Error
    console.error('Error al subir a Cloudflare R2:', error)
    return NextResponse.json({ error: error?.message || 'Error al subir la imagen' }, { status: 500 })
  }
}
