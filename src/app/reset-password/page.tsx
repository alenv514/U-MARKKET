'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Comprobar si hay sesión activa procedente del link de recuperación
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('El enlace ha expirado o es inválido. Por favor solicita uno nuevo.')
      }
    })
  }, [supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8 || password.length > 20) {
      setError('La contraseña debe tener entre 8 y 20 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Logo */}
        <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', fontWeight: 900, color: 'white',
            margin: '0 auto 1rem',
            boxShadow: '0 0 28px rgba(99,102,241,0.4)',
          }}>U</div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900 }}>Nueva contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Ingresa tu nueva clave de acceso
          </p>
        </div>

        {/* Card */}
        <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff' }}>
                ¡Contraseña actualizada!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Tu contraseña se ha cambiado exitosamente. Ya puedes iniciar sesión con tu nueva clave.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                Ir a Iniciar Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Nueva contraseña (entre 8 y 20 caracteres)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    maxLength={20}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingRight: '2.75rem' }}
                    required
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Confirmar nueva contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    maxLength={20}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingRight: '2.75rem' }}
                    required
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
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ padding: '0.8rem' }}
              >
                {loading ? 'Guardando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
