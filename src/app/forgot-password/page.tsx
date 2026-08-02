'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      })

      if (resetError) {
        throw new Error(resetError.message)
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de recuperación')
    } finally {
      setLoading(false)
    }
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
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900 }}>Recuperar contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Te enviaremos un enlace a tu correo para restablecerla
          </p>
        </div>

        {/* Card */}
        <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📨</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff' }}>
                ¡Correo enviado!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Hemos enviado las instrucciones a <strong style={{ color: '#ffffff' }}>{email}</strong>. Revisa tu bandeja de entrada o correo no deseado (SPAM).
              </p>
              <Link href="/login">
                <button className="btn-secondary" style={{ width: '100%', padding: '0.75rem' }}>
                  Volver al inicio de sesión
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Correo electrónico institucional
                </label>
                <input
                  type="email"
                  placeholder="nombre@uta.edu.ec"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ padding: '0.8rem' }}
              >
                {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <Link href="/login" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
