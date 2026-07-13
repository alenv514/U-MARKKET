import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitize, isValidEcuadorPhone } from '@/lib/utils'

// ── Rate limiter simple en memoria ──
const registerAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 60_000 // 1 minuto

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = registerAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}



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
    const { email, password, fullName, phone } = body

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

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Sanitizar inputs de texto
    const safeFullName = fullName ? sanitize(fullName) : ''
    const safePhone = phone ? sanitize(phone) : ''

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
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (safePhone && data.user) {
      await supabase
        .from('profiles')
        .update({ phone: safePhone })
        .eq('id', data.user.id)
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
