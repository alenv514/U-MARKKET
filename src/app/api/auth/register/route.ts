import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sanitize, isValidEcuadorPhone } from '@/lib/utils'
import { createRateLimiter } from '@/lib/rate-limit'

// ── Rate limiter simple en memoria (3 intentos/minuto por IP) ──
const isRateLimited = createRateLimiter(3, 60_000)



export async function POST(request: NextRequest) {
  try {
    // Rate limiting por IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, password, fullName, phone, faculty, career, semester } = body

    // ── Validación de dominio en el backend ──
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Correo requerido' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@uta\.edu\.ec$/i
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Solo se permiten correos @uta.edu.ec' },
        { status: 403 }
      )
    }

    if (!password || password.length < 8 || password.length > 20) {
      return NextResponse.json(
        { error: 'La contraseña debe tener entre 8 y 20 caracteres' },
        { status: 400 }
      )
    }

    // Sanitizar inputs de texto
    const safeFullName = fullName ? sanitize(fullName) : ''
    const safePhone = phone ? sanitize(phone) : ''
    const safeFaculty = faculty ? sanitize(faculty) : ''
    const safeCareer = career ? sanitize(career) : ''
    const safeSemesterOnly = semester ? sanitize(semester) : ''
    const safeSemester = safeFaculty && safeCareer && safeSemesterOnly
      ? `${safeSemesterOnly} - ${safeCareer}`
      : safeSemesterOnly || null

    if (safePhone && !isValidEcuadorPhone(safePhone)) {
      return NextResponse.json(
        { error: 'Formato de teléfono inválido. Usa +593XXXXXXXXX o 09XXXXXXXX' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
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
        await serviceClient
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: safeFullName || '',
            email: email.toLowerCase().trim(),
            phone: safePhone || null,
            faculty: safeFaculty || null,
            semester: safeSemester || null,
            role: 'buyer',
            is_active: true,
          }, { onConflict: 'id' })
      } catch (profileErr) {
        console.error('Error persistiendo perfil con serviceClient:', profileErr)
      }
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
