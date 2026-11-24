import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { isMailerConfigured, sendRegistrationCodeEmail } from '@/lib/mailer'

const isIpRateLimited = createRateLimiter(30, 60_000)
const isEmailRateLimited = createRateLimiter(3, 60_000)

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'

    if (isIpRateLimited(`resend_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de reenvío. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !/^[^\s@]+@uta\.edu\.ec$/i.test(email)) {
      return NextResponse.json({ error: 'Correo institucional @uta.edu.ec requerido' }, { status: 400 })
    }

    if (isEmailRateLimited(`resend_email:${email}`)) {
      return NextResponse.json(
        { error: 'Espera 1 minuto antes de solicitar otro reenvío.' },
        { status: 429 }
      )
    }

    if (isMailerConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createServiceClient()

      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id, full_name')
        .eq('email', email)
        .maybeSingle()

      if (!profile?.id) {
        return NextResponse.json({ error: 'No encontramos un registro pendiente para este correo.' }, { status: 404 })
      }

      const { data: userLookup, error: lookupError } = await serviceClient.auth.admin.getUserById(profile.id)
      if (lookupError || !userLookup?.user) {
        return NextResponse.json({ error: 'No se pudo verificar el estado de la cuenta.' }, { status: 400 })
      }

      if (userLookup.user.email_confirmed_at) {
        return NextResponse.json(
          { error: 'Esta cuenta ya está verificada. Ya puedes iniciar sesión.' },
          { status: 409 }
        )
      }

      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

      const otp = linkData?.properties?.email_otp
      if (linkError || !otp) {
        console.error('Error generando nuevo código OTP:', linkError?.message)
        return NextResponse.json({ error: 'No se pudo generar un nuevo código.' }, { status: 500 })
      }

      await sendRegistrationCodeEmail({
        to: email,
        code: otp,
        fullName: profile.full_name,
      })

      return NextResponse.json({ success: true, otpType: 'email' })
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      return NextResponse.json({ error: error.message || 'No se pudo reenviar el correo.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, otpType: 'signup' })
  } catch (err) {
    console.error('Error en resend:', err)
    return NextResponse.json({ error: 'Error al reenviar el correo de verificación.' }, { status: 500 })
  }
}
