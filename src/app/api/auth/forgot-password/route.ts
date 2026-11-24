import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { isMailerConfigured, sendPasswordResetCodeEmail } from '@/lib/mailer'

const isIpRateLimited = createRateLimiter(30, 60_000)
const isEmailRateLimited = createRateLimiter(3, 60_000)

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'

    if (isIpRateLimited(`forgot_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !/^[^\s@]+@uta\.edu\.ec$/i.test(email)) {
      return NextResponse.json(
        { error: 'Ingresa un correo institucional @uta.edu.ec válido.' },
        { status: 400 }
      )
    }

    if (isEmailRateLimited(`forgot_email:${email}`)) {
      return NextResponse.json(
        { error: 'Espera 1 minuto antes de solicitar otro código.' },
        { status: 429 }
      )
    }

    if (!isMailerConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ fallback: true })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (profile?.id) {
      const { data: userLookup } = await serviceClient.auth.admin.getUserById(profile.id)
      if (userLookup?.user?.email_confirmed_at) {
        const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
          type: 'recovery',
          email,
        })

        const otp = linkData?.properties?.email_otp
        if (linkErr || !otp) {
          console.error('Error generando código de recuperación:', linkErr?.message)
          return NextResponse.json(
            { error: 'No se pudo generar el código de recuperación.' },
            { status: 500 }
          )
        }

        await sendPasswordResetCodeEmail({ to: email, code: otp })
      }
    }

    return NextResponse.json({ success: true, mode: 'otp' })
  } catch (err) {
    console.error('Error en forgot-password:', err)
    return NextResponse.json(
      { error: 'No pudimos enviar el correo de recuperación. Intenta más tarde.' },
      { status: 500 }
    )
  }
}
