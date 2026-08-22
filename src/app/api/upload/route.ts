import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Debes iniciar sesión.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'listings'

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Solo se permiten imágenes válidas (JPG, PNG, WEBP, GIF)' }, { status: 400 })
    }

    // Validar tamaño máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen excede el tamaño máximo permitido (10MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`

    // Subir a Cloudflare R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    })

    await r2.send(uploadCommand)

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${fileName}`

    return NextResponse.json({ success: true, url: publicUrl, fileName })
  } catch (err: any) {
    console.error('Error al subir a Cloudflare R2:', err)
    return NextResponse.json({ error: err.message || 'Error al subir la imagen' }, { status: 500 })
  }
}
