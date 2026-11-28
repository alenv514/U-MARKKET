import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitize, isValidEcuadorPhone, isSyntheticQrEmail } from '@/lib/utils'
import { createRateLimiter } from '@/lib/rate-limit'
import { isMailerConfigured, sendRegistrationCodeEmail } from '@/lib/mailer'
import { buildQrSyntheticAuthEmail, verifyQrVerificationToken } from '@/lib/uta-carnet'

const isIpRateLimited = createRateLimiter(60, 60_000)
const isAccountRateLimited = createRateLimiter(3, 60_000)

export async function POST(request: NextRequest) {
  try {
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
    const {
      mode,
      email,
      password,
      fullName,
      phone,
      faculty,
      career,
      semester,
      qrVerificationToken,
    } = body

    const registerMode: 'qr' | 'email' =
      mode === 'email' || (!qrVerificationToken && typeof email === 'string' && email.trim().length > 0)
        ? 'email'
        : 'qr'

    if (typeof password !== 'string' || password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: 'La contraseña debe tener entre 8 y 20 caracteres' },
        { status: 400 }
      )
    }

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

    // ── FLUJO 1: REGISTRO INMEDIATO CON CREDENCIAL DIGITAL UTA (QR -> usuario = cédula) ──
    if (registerMode === 'qr') {
      const verifiedQr = typeof qrVerificationToken === 'string'
        ? verifyQrVerificationToken(qrVerificationToken)
        : null

      if (!verifiedQr) {
        return NextResponse.json(
          {
            error: 'Debes validar primero el código QR de tu Credencial Digital UTA vigente.',
            code: 'QR_REQUIRED',
          },
          { status: 400 }
        )
      }

      if (isAccountRateLimited(`reg_qr:${verifiedQr.cedulaHash}`)) {
        return NextResponse.json(
          { error: 'Demasiados intentos para esta credencial. Intenta de nuevo en 1 minuto.' },
          { status: 429 }
        )
      }

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { error: 'Servicio de registro por QR no configurado en el servidor.' },
          { status: 500 }
        )
      }

      const serviceClient = createServiceClient()
      const { data: existingCedula, error: cedulaLookupErr } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('cedula_hash', verifiedQr.cedulaHash)
        .maybeSingle()

      if (cedulaLookupErr) {
        console.error('Error verificando unicidad de cédula en registro QR:', cedulaLookupErr.message)
        return NextResponse.json(
          { error: 'No se pudo validar la unicidad de tu cédula. Intenta de nuevo.' },
          { status: 500 }
        )
      }

      if (existingCedula?.id) {
        return NextResponse.json(
          {
            error: 'Esta cédula ya se encuentra registrada en otra cuenta de U-Market.',
            code: 'CEDULA_EXISTS',
          },
          { status: 409 }
        )
      }

      const officialFullName = sanitize(verifiedQr.officialName).slice(0, 120)
      const qrAuthEmail = buildQrSyntheticAuthEmail(verifiedQr.cedulaHash)
      const now = new Date().toISOString()

      const { data: createdAuth, error: createAuthErr } = await serviceClient.auth.admin.createUser({
        email: qrAuthEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: officialFullName,
          phone: safePhone,
          faculty: safeFaculty || null,
          semester: safeSemester || null,
          auth_method: 'qr',
        },
      })

      if (createAuthErr || !createdAuth?.user) {
        const msg = createAuthErr?.message?.toLowerCase() || ''
        if (msg.includes('already') || createAuthErr?.code === 'email_exists') {
          return NextResponse.json(
            {
              error: 'Esta cédula ya se encuentra registrada en otra cuenta de U-Market.',
              code: 'CEDULA_EXISTS',
            },
            { status: 409 }
          )
        }
        console.error('Error creando usuario por QR:', createAuthErr?.message)
        return NextResponse.json(
          { error: 'No se pudo completar el registro con tu credencial UTA.' },
          { status: 400 }
        )
      }

      const { error: profileUpsertErr } = await serviceClient
        .from('profiles')
        .upsert({
          id: createdAuth.user.id,
          full_name: officialFullName,
          email: null,
          phone: safePhone || null,
          faculty: safeFaculty || null,
          semester: safeSemester || null,
          role: 'buyer',
          is_active: true,
          cedula_hash: verifiedQr.cedulaHash,
          is_verified: true,
          verification_status: 'approved',
          verification_rejected_reason: null,
          verified_at: now,
          verification_submitted_at: now,
        }, { onConflict: 'id' })

      if (profileUpsertErr) {
        await serviceClient.auth.admin.deleteUser(createdAuth.user.id).catch(() => {})
        if (profileUpsertErr.code === '23505') {
          return NextResponse.json(
            {
              error: 'Esta cédula ya se encuentra registrada en otra cuenta de U-Market.',
              code: 'CEDULA_EXISTS',
            },
            { status: 409 }
          )
        }
        console.error('Error guardando perfil tras registro QR:', profileUpsertErr.message)
        return NextResponse.json(
          { error: 'No se pudo guardar tu perfil estudiantil.' },
          { status: 500 }
        )
      }

      const supabase = await createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: qrAuthEmail,
        password,
      })

      return NextResponse.json({
        success: true,
        mode: 'qr',
        hasSession: !signInErr,
      })
    }

    // ── FLUJO 2: REGISTRO CLÁSICO POR CORREO INSTITUCIONAL (@uta.edu.ec + OTP) ──
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (isAccountRateLimited(`reg_email:${normalizedEmail}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos de registro para este correo. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    if (isSyntheticQrEmail(normalizedEmail) || !/^[^\s@]+@uta\.edu\.ec$/i.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Solo se permiten correos @uta.edu.ec' },
        { status: 403 }
      )
    }

    const safeFullName = typeof fullName === 'string' ? sanitize(fullName).slice(0, 120) : ''
    if (safeFullName.length < 3) {
      return NextResponse.json(
        { error: 'Ingresa tu nombre completo' },
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
        auth_method: 'email',
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
          return NextResponse.json({ error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS' }, { status: 409 })
        }

        const { data: existingAuth } = await serviceClient.auth.admin.getUserById(existingProfile.id)
        if (!existingAuth?.user || existingAuth.user.email_confirmed_at) {
          return NextResponse.json({ error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS' }, { status: 409 })
        }

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

      return NextResponse.json({ success: true, mode: 'email', userId: targetUserId, otpType })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: safeFullName,
          phone: safePhone,
          faculty: safeFaculty || null,
          semester: safeSemester || null,
          auth_method: 'email',
        },
      },
    })

    if (error) {
      console.error('Registration failed:', error.message)
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message || 'Error al procesar el registro' }, { status: 400 })
    }

    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return NextResponse.json({ error: 'Este correo ya está registrado', code: 'EMAIL_EXISTS' }, { status: 409 })
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

    return NextResponse.json({ success: true, mode: 'email', userId: data.user?.id, otpType: 'signup' })
  } catch (err) {
    console.error('Registration endpoint error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
