import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

// Rate limiter adaptado a redes de campus universitario compartidas (NAT Wi-Fi UTA):
// - Límite global por IP amplio para no bloquear laboratorios de cómputo o Wi-Fi institucional.
// - Límite estricto por cuenta (correo) para proteger contra ataques de fuerza bruta.
const isIpRateLimited = createRateLimiter(100, 60_000)
const isEmailRateLimited = createRateLimiter(5, 60_000)

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'

  if (isIpRateLimited(`ip:${ip}`)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes desde esta red. Intenta de nuevo en 1 minuto.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }

    if (isEmailRateLimited(`login:${email}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos para este correo. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ success: true, session: data.session })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
