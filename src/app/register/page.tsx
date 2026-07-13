'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const validateEmail = (email: string) => /^[^\s@]+@uta\.edu\.ec$/i.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Solo se permiten correos @uta.edu.ec')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    // Validación adicional en "backend" (API route)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Error al registrarse')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="glass-card animate-fade-in" style={{ maxWidth: 440, width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>¡Verifica tu correo!</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Te enviamos un enlace de confirmación a <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
          </p>
          <Link href="/login">
            <button className="btn-primary" style={{ width: '100%' }}>Ir al inicio de sesión</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div style={{ maxWidth: 480, width: '100%' }}>

        {/* Logo */}
        <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 900, color: 'white',
            margin: '0 auto 1rem',
            boxShadow: '0 0 32px rgba(99,102,241,0.4)',
          }}>U</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Únete a U-Market</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Solo para estudiantes de la <strong style={{ color: 'var(--text-primary)' }}>UTA</strong>
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Nombre completo
              </label>
              <input
                id="register-name"
                type="text"
                placeholder="Juan Pérez"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Correo institucional
              </label>
              <input
                id="register-email"
                type="email"
                placeholder="nombre@uta.edu.ec"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                required
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                ⚠️ Solo se aceptan correos @uta.edu.ec
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Número WhatsApp (opcional)
              </label>
              <input
                id="register-phone"
                type="tel"
                placeholder="+593 99 999 9999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input-field"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Formato: +593XXXXXXXXX o 09XXXXXXXX
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                id="register-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Confirmar contraseña
              </label>
              <input
                id="register-confirm-password"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input-field"
                required
              />
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
              id="register-submit"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: 4, padding: '0.8rem' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  Registrando...
                </span>
              ) : 'Crear cuenta'}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Al registrarte aceptas nuestros{' '}
              <Link href="/terminos" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Términos y Condiciones</Link>
              {' '}y la{' '}
              <Link href="/privacidad" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Política de Privacidad</Link>.
            </p>
          </form>

          <div className="divider" />

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
