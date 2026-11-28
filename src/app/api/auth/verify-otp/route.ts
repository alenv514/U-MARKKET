import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

const isIpVerifyRateLimited = createRateLimiter(30, 60_000)

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'

    if (isIpVerifyRateLimited(`verify_otp_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos de verificación. Espera 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const type = body?.type === 'email' ? 'email' : 'signup'

    if (!email || !/^[^\s@]+@uta\.edu\.ec$/i.test(email)) {
      return NextResponse.json({ error: 'Correo institucional @uta.edu.ec requerido.' }, { status: 400 })
    }
    if (!/^\d{6,8}$/.test(token)) {
      return NextResponse.json({ error: 'Código de verificación inválido.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })

    if (error || !data?.user) {
      return NextResponse.json(
        { error: error?.message || 'Código incorrecto o expirado. Verifica los números ingresados.' },
        { status: 400 }
      )
    }

    let qrVerified = false
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createServiceClient()
      const { data: userLookup } = await serviceClient.auth.admin.getUserById(data.user.id)
      const metadata = userLookup?.user?.user_metadata || {}
      const pendingCedulaHash = typeof metadata.pending_cedula_hash === 'string'
        ? metadata.pending_cedula_hash
        : ''
      const verifiedName = typeof metadata.qr_verified_name === 'string'
        ? metadata.qr_verified_name.trim()
        : ''

      if (pendingCedulaHash) {
        const { data: duplicateOwner } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('cedula_hash', pendingCedulaHash)
          .neq('id', data.user.id)
          .maybeSingle()

        if (duplicateOwner?.id) {
          return NextResponse.json(
            {
              error: 'Esta cédula ya fue verificada en otra cuenta de U-Market.',
              emailConfirmed: true,
              code: 'CEDULA_EXISTS',
            },
            { status: 409 }
          )
        }

        const now = new Date().toISOString()
        const updatePayload: {
          cedula_hash: string
          is_verified: boolean
          verification_status: string
          verification_rejected_reason: null
          verified_at: string
          verification_submitted_at: string
          full_name?: string
        } = {
          cedula_hash: pendingCedulaHash,
          is_verified: true,
          verification_status: 'approved',
          verification_rejected_reason: null,
          verified_at: now,
          verification_submitted_at: now,
        }

        if (verifiedName) {
          updatePayload.full_name = verifiedName
        }

        const { error: profileErr } = await serviceClient
          .from('profiles')
          .update(updatePayload)
          .eq('id', data.user.id)

        if (profileErr) {
          if (profileErr.code === '23505') {
            return NextResponse.json(
              {
                error: 'Esta cédula ya fue verificada en otra cuenta de U-Market.',
                emailConfirmed: true,
                code: 'CEDULA_EXISTS',
              },
              { status: 409 }
            )
          }
          console.error('Error guardando verificación QR tras OTP:', profileErr.message)
        } else {
          qrVerified = true
          await serviceClient.auth.admin.updateUserById(data.user.id, {
            user_metadata: {
              ...metadata,
              pending_cedula_hash: null,
            },
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({
      success: true,
      hasSession: Boolean(data.session),
      verified: qrVerified,
    })
  } catch (err) {
    console.error('Error en /api/auth/verify-otp:', err)
    return NextResponse.json(
      { error: 'Error interno al verificar el código.' },
      { status: 500 }
    )
  }
}
