import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { signQrVerificationToken, verifyUtaCarnetByQrUrl } from '@/lib/uta-carnet'

const isIpQrRateLimited = createRateLimiter(20, 60_000)

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'

    if (isIpQrRateLimited(`qr_verify_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiadas verificaciones de QR seguidas. Espera 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const qrUrl = typeof body?.qrUrl === 'string' ? body.qrUrl.trim() : ''

    if (!qrUrl) {
      return NextResponse.json(
        { error: 'Se requiere la URL del código QR de la credencial UTA.' },
        { status: 400 }
      )
    }

    const result = await verifyUtaCarnetByQrUrl(qrUrl)
    if (!result.valid || !result.cedulaHash || !result.officialName) {
      return NextResponse.json(
        { error: result.error || 'No se pudo validar la credencial UTA.' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()
    const { data: existingProfile, error: lookupError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('cedula_hash', result.cedulaHash)
      .maybeSingle()

    if (lookupError) {
      console.error('Error comprobando unicidad de cedula_hash:', lookupError.message)
      return NextResponse.json(
        { error: 'No se pudo verificar la unicidad de la cédula en la base de datos.' },
        { status: 500 }
      )
    }

    if (existingProfile?.id) {
      return NextResponse.json(
        {
          error: 'Esta cédula ya se encuentra vinculada a otra cuenta de U-Market. Cada estudiante puede tener una sola cuenta.',
          code: 'CEDULA_EXISTS',
        },
        { status: 409 }
      )
    }

    const token = signQrVerificationToken({
      cedulaHash: result.cedulaHash,
      officialName: result.officialName,
      academicPeriod: result.academicPeriod ?? null,
    })

    return NextResponse.json({
      valid: true,
      officialName: result.officialName,
      cedula: result.identificacion,
      academicPeriod: result.academicPeriod ?? null,
      token,
    })
  } catch (err) {
    console.error('Error en /api/uta/verify-qr:', err)
    return NextResponse.json(
      { error: 'Error interno al validar el código QR.' },
      { status: 500 }
    )
  }
}
