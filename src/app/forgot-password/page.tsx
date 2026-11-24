'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mode, setMode] = useState<'otp' | 'link'>('otp')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [resendTimer, setResendTimer] = useState(180)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (!success || resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [success, resendTimer])

  const requestRecoveryEmail = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'No se pudo enviar el correo de recuperación')
    }

    if (data.fallback) {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo })
      if (resetError) throw new Error(resetError.message)
      setMode('link')
      return
    }

    setMode('otp')
  }

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return
    setResendLoading(true)
    setResendMessage('')
    try {
      await requestRecoveryEmail()
      setResendMessage('¡Correo reenviado con éxito! Revisa tu bandeja.')
      setResendTimer(180)
    } catch (err: unknown) {
      const e = err as Error
      setResendMessage('Error al reenviar: ' + (e?.message || 'Inténtalo más tarde.'))
    } finally {
      setResendLoading(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestRecoveryEmail()
      setSuccess(true)
      setResendTimer(180)
    } catch (err: unknown) {
      const e = err as Error
      setError(e?.message || 'Error al enviar el correo de recuperación')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = otpCode.trim()
    if (cleanCode.length < 6) {
      setOtpError('Ingresa el código completo recibido en tu correo')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanCode,
        type: 'recovery',
      })

      if (verifyErr) throw verifyErr
      router.push('/reset-password')
    } catch (err: unknown) {
      const e = err as Error
      setOtpError(e?.message || 'Código incorrecto o expirado.')
    } finally {
      setOtpLoading(false)
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
              background: 'linear-gradient(135deg, #00345e, #004b87)',
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 900, color: 'white',
              boxShadow: '0 4px 20px rgba(0, 52, 94, 0.3)',
            }}>U</div>
          </Link>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900 }}>Recuperar contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Te enviaremos un código a tu correo para restablecerla
          </p>
        </div>

        {/* Card */}
        <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#00345e' }}>
                <Icon name="mail" size={44} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem', color: '#0a192f' }}>
                {mode === 'otp' ? 'Ingresa tu código' : '¡Correo enviado!'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                {mode === 'otp' ? (
                  <>
                    Si existe una cuenta para <strong style={{ color: '#0a192f' }}>{email}</strong>, enviamos el código de recuperación a tu correo.
                  </>
                ) : (
                  <>
                    Hemos enviado las instrucciones a <strong style={{ color: '#0a192f' }}>{email}</strong>. Revisa tu bandeja de entrada o correo no deseado.
                  </>
                )}
              </p>

              {mode === 'otp' && (
                <form onSubmit={handleVerifyOtp} style={{ marginBottom: '1.25rem' }}>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''))
                      if (otpError) setOtpError('')
                    }}
                    autoFocus
                    className="input-field"
                    style={{
                      textAlign: 'center',
                      letterSpacing: '4px',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      marginBottom: '0.75rem',
                    }}
                  />

                  {otpError && (
                    <div style={{
                      padding: '0.6rem 0.8rem', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.82rem',
                      background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                    }}>
                      {otpError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.trim().length < 6}
                    className="btn-primary"
                    style={{
                      width: '100%', padding: '0.8rem', fontSize: '0.92rem', fontWeight: 700,
                      opacity: (otpLoading || otpCode.trim().length < 6) ? 0.6 : 1,
                    }}
                  >
                    {otpLoading ? 'Verificando...' : 'Continuar'}
                  </button>
                </form>
              )}

              {resendMessage && (
                <div style={{
                  padding: '0.6rem 0.8rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem',
                  background: resendMessage.includes('Error') ? '#fef2f2' : '#eff6ff',
                  color: resendMessage.includes('Error') ? '#b91c1c' : '#00345e',
                  border: resendMessage.includes('Error') ? '1px solid #fecaca' : '1px solid #bfdbfe'
                }}>
                  {resendMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendTimer > 0 || resendLoading}
                  className={mode === 'otp' ? 'btn-secondary' : 'btn-primary'}
                  style={{
                    width: '100%', padding: '0.75rem', fontSize: '0.88rem',
                    opacity: (resendTimer > 0 || resendLoading) ? 0.6 : 1,
                    cursor: (resendTimer > 0 || resendLoading) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {resendLoading ? (
                    'Reenviando...'
                  ) : resendTimer > 0 ? (
                    <>
                      <Icon name="refresh" size={14} /> Reenviar código en ({formatTimer(resendTimer)})
                    </>
                  ) : (
                    <>
                      <Icon name="refresh" size={14} /> Reenviar código
                    </>
                  )}
                </button>

                <Link href="/login" style={{ width: '100%', textDecoration: 'none' }}>
                  <button type="button" className="btn-secondary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem' }}>
                    Volver al inicio de sesión
                  </button>
                </Link>
              </div>
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
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 10, padding: '0.75rem 1rem',
                  fontSize: '0.85rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Icon name="alert" size={16} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ padding: '0.8rem' }}
              >
                {loading ? 'Enviando código...' : 'Enviar código de recuperación'}
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
