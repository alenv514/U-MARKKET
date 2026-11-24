import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitize, isValidEcuadorPhone } from '@/lib/utils'
import { createRateLimiter } from '@/lib/rate-limit'
import { isMailerConfigured, sendRegistrationCodeEmail } from '@/lib/mailer'

// ── Rate limiter adaptado a registros simultáneos en campus UTA (aulas, inducción) ──
const isIpRateLimited = createRateLimiter(60, 60_000)
const isEmailRateLimited = createRateLimiter(3, 60_000)

export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP general (permite hasta 60 registros/minuto por red de campus)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    if (isIpRateLimited(`reg_ip:${ip}`)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de registro desde esta red. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, password, fullName, phone, faculty, career, semester } = body

    // ── Validación de dominio en el backend ──
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Rate limiting específico por correo para evitar abusos sobre una misma cuenta
    if (isEmailRateLimited(`reg_email:${normalizedEmail}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos de registro para este correo. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const emailRegex = /^[^\s@]+@uta\.edu\.ec$/i
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Solo se permiten correos @uta.edu.ec' },
        { status: 403 }
      )
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: 'La contraseña debe tener entre 8 y 20 caracteres' },
        { status: 400 }
      )
    }

    // Sanitizar inputs de texto
    const safeFullName = typeof fullName === 'string' ? sanitize(fullName).slice(0, 120) : ''
    const safePhone = typeof phone === 'string' ? sanitize(phone).slice(0, 20) : ''
    const safeFaculty = typeof faculty === 'string' ? sanitize(faculty).slice(0, 120) : ''
    const safeCareer = typeof career === 'string' ? sanitize(career).slice(0, 120) : ''
    const safeSemesterOnly = typeof semester === 'string' ? sanitize(semester).slice(0, 40) : ''
    const safeSemester = safeFaculty && safeCareer && safeSemesterOnly
      ? `${safeSemesterOnly} - ${safeCareer}`
      : safeSemesterOnly || null

    if (safePhone && !isValidEcuadorPhone(safePhone)) {
      return NextResponse.json(
        { error: 'Formato de teléfono inválido. Usa +593XXXXXXXXX o 09XXXXXXXX' },
        { status: 400 }
      )
    }

    if (isMailerConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createServiceClient()
      const userMetadata = {
        full_name: safeFullName,
        phone: safePhone,
        faculty: safeFaculty || null,
        semester: safeSemester || null,
      }

      let targetUserId: string | undefined
      let otpCode: string | undefined
      let otpType: 'signup' | 'email' = 'signup'
      let isNewlyCreated = false

      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password,
        options: { data: userMetadata },
      })

      if (!linkError && linkData?.user && linkData?.properties?.email_otp) {
        targetUserId = linkData.user.id
        otpCode = linkData.properties.email_otp
        otpType = 'signup'
        isNewlyCreated = true
      } else if (
        linkError &&
        (linkError.message.toLowerCase().includes('already') ||
          linkError.code === 'email_exists')
      ) {
        const { data: existingProfile } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (!existingProfile?.id) {
          return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
        }

        const { data: existingAuth } = await serviceClient.auth.admin.getUserById(existingProfile.id)
        if (!existingAuth?.user || existingAuth.user.email_confirmed_at) {
          return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
        }

        // Cuenta aún sin confirmar: actualizar contraseña/datos y reenviar nuevo OTP vía SMTP propio
        const { error: updateErr } = await serviceClient.auth.admin.updateUserById(existingAuth.user.id, {
          password,
          user_metadata: userMetadata,
        })
        if (updateErr) {
          console.error('Error actualizando usuario pendiente:', updateErr.message)
          return NextResponse.json({ error: 'Error al regenerar el registro pendiente' }, { status: 400 })
        }

        const { data: resendLinkData, error: resendLinkErr } = await serviceClient.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
        })
        if (resendLinkErr || !resendLinkData?.properties?.email_otp) {
          console.error('Error generando OTP para usuario pendiente:', resendLinkErr?.message)
          return NextResponse.json({ error: 'No se pudo generar el código de verificación' }, { status: 500 })
        }

        targetUserId = existingAuth.user.id
        otpCode = resendLinkData.properties.email_otp
        otpType = 'email'
      } else {
        console.error('Registration generateLink failed:', linkError?.message)
        return NextResponse.json(
          { error: linkError?.message || 'Error al procesar el registro' },
          { status: 400 }
        )
      }

      try {
        await sendRegistrationCodeEmail({
          to: normalizedEmail,
          code: otpCode,
          fullName: safeFullName,
        })
      } catch (mailErr) {
        console.error('Error enviando correo de registro con nodemailer:', mailErr)
        if (isNewlyCreated && targetUserId) {
          await serviceClient.auth.admin.deleteUser(targetUserId).catch(() => {})
        }
        return NextResponse.json(
          { error: 'No pudimos enviar el código a tu correo UTA. Intenta de nuevo en unos momentos.' },
          { status: 500 }
        )
      }

      if (targetUserId) {
        try {
          const { error: profileErr } = await serviceClient
            .from('profiles')
            .upsert({
              id: targetUserId,
              full_name: safeFullName || '',
              email: normalizedEmail,
              phone: safePhone || null,
              faculty: safeFaculty || null,
              semester: safeSemester || null,
              role: 'buyer',
              is_active: true,
            }, { onConflict: 'id' })
          if (profileErr) {
            console.error('Error persistiendo perfil con serviceClient:', profileErr.message)
          }
        } catch (profileErr) {
          console.error('Error persistiendo perfil con serviceClient:', profileErr)
        }
      }

      return NextResponse.json({ success: true, userId: targetUserId, otpType })
    }

    const supabase = await createClient()

    // Crear usuario en Supabase Auth (respaldo si no hay mailer SMTP configurado)
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: safeFullName,
          phone: safePhone,
          faculty: safeFaculty || null,
          semester: safeSemester || null,
        },
      },
    })

    if (error) {
      console.error('Registration failed:', error.message)
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message || 'Error al procesar el registro' }, { status: 400 })
    }

    // Supabase devuelve usuario con identities vacío cuando el correo ya existe
    // en lugar de lanzar un error (comportamiento de "email enumeration protection")
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
    }

    if (data.user) {
      try {
        const serviceClient = createServiceClient()
        const { error: profileErr } = await serviceClient
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: safeFullName || '',
            email: normalizedEmail,
            phone: safePhone || null,
            faculty: safeFaculty || null,
            semester: safeSemester || null,
            role: 'buyer',
            is_active: true,
          }, { onConflict: 'id' })
        if (profileErr) {
          console.error('Error persistiendo perfil con serviceClient:', profileErr.message)
        }
      } catch (profileErr) {
        console.error('Error persistiendo perfil con serviceClient:', profileErr)
      }
    }

    return NextResponse.json({ success: true, userId: data.user?.id, otpType: 'signup' })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
