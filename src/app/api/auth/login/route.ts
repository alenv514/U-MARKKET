import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { isSyntheticQrEmail } from '@/lib/utils'
import { computeCedulaHash } from '@/lib/uta-carnet'

const isIpRateLimited = createRateLimiter(100, 60_000)
const isAccountRateLimited = createRateLimiter(5, 60_000)

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
    const rawIdentifier = typeof body?.identifier === 'string'
      ? body.identifier
      : typeof body?.email === 'string'
        ? body.email
        : ''
    const identifier = rawIdentifier.trim()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Usuario/correo y contraseña son requeridos' }, { status: 400 })
    }

    const rateKey = identifier.toLowerCase()
    if (isAccountRateLimited(`login:${rateKey}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos para esta cuenta. Intenta de nuevo en 1 minuto.' },
        { status: 429 }
      )
    }

    let resolvedEmail: string | null = null

    if (identifier.includes('@')) {
      const normalized = identifier.toLowerCase()
      if (isSyntheticQrEmail(normalized)) {
        return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
      }
      resolvedEmail = normalized
    } else if (/^[A-Za-z0-9-]{6,20}$/.test(identifier) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const cedulaHash = computeCedulaHash(identifier)
      const serviceClient = createServiceClient()
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('cedula_hash', cedulaHash)
        .maybeSingle()

      if (profile?.id) {
        const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.id)
        resolvedEmail = authUser?.user?.email ?? null
      }
    }

    if (!resolvedEmail) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ success: true, session: data.session })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
