'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const loginAttempts = useRef(0)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Limpiar intervalo al desmontar
  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
  }, [])

  const startCooldown = () => {
    let remaining = 60
    setCooldown(remaining)
    cooldownTimer.current = setInterval(() => {
      remaining--
      setCooldown(remaining)
      if (remaining <= 0) {
        if (cooldownTimer.current) clearInterval(cooldownTimer.current)
        setCooldown(0)
        loginAttempts.current = 0
      }
    }, 1000)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cooldown > 0) return

    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      loginAttempts.current++
      if (loginAttempts.current >= 5) {
        startCooldown()
        setError('Demasiados intentos. Espera 1 minuto antes de intentar de nuevo.')
      } else if (authError.message.toLowerCase().includes('confirm') || authError.message.toLowerCase().includes('verified')) {
        setError('Por favor, confirma tu correo electrónico usando el enlace enviado a tu bandeja de entrada.')
      } else {
        setError('Correo o contraseña incorrectos')
      }
      setLoading(false)
      return
    }

    loginAttempts.current = 0
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-container">
      <div style={{ maxWidth: 440, width: '100%' }}>

        {/* Logo */}
        <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <div style={{
              width: 52, height: 52,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 900, color: 'white',
              boxShadow: '0 0 28px rgba(99,102,241,0.4)',
            }}>U</div>
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Bienvenido de vuelta</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Inicia sesión con tu cuenta UTA
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Correo institucional
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="nombre@uta.edu.ec"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Contraseña
                </label>
                <Link href="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingRight: '2.75rem' }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '0.75rem 1rem',
                fontSize: '0.85rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn-primary"
              disabled={loading || cooldown > 0}
              style={{ padding: '0.8rem', marginTop: 4 }}
            >
              {cooldown > 0 ? `Espera ${cooldown}s` : loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  Ingresando...
                </span>
              ) : 'Ingresar'}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Al continuar aceptas nuestros{' '}
              <Link href="/terminos" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Términos y Condiciones</Link>
              {' '}y la{' '}
              <Link href="/privacidad" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Política de Privacidad</Link>.
            </p>
          </form>

          <div className="divider" />

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            ¿No tienes cuenta?{' '}
            <Link href="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
