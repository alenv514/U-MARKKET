'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UTA_FACULTY_CAREERS, SEMESTERS } from '@/types'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [faculty, setFaculty] = useState('')
  const [career, setCareer] = useState('')
  const [semester, setSemester] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showAlreadyRegisteredModal, setShowAlreadyRegisteredModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [resendTimer, setResendTimer] = useState(180)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  const supabase = createClient()

  // Countdown timer for resend
  useEffect(() => {
    if (!success || resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [success, resendTimer])

  const handleResendEmail = async () => {
    if (resendTimer > 0 || resendLoading) return
    setResendLoading(true)
    setResendMessage('')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      })
      if (error) throw error
      setResendMessage('¡Correo de confirmación reenviado con éxito!')
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

  const validateEmail = (email: string) => /^[^\s@]+@uta\.edu\.ec$/i.test(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Solo se permiten correos @uta.edu.ec')
      return
    }
    if (!faculty) {
      setError('Por favor selecciona tu facultad')
      return
    }
    if (!career) {
      setError('Por favor selecciona tu carrera')
      return
    }
    if (!semester) {
      setError('Por favor selecciona tu semestre')
      return
    }
    if (password.length < 8 || password.length > 20) {
      setError('La contraseña debe tener entre 8 y 20 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad')
      return
    }

    setLoading(true)

    // Validación adicional en "backend" (API route)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone, faculty, career, semester }),
    })
    const result = await res.json()

    if (!res.ok) {
      const errMsg = (result.error || '').toLowerCase()
      if (res.status === 409 || errMsg.includes('registrado') || errMsg.includes('already')) {
        setShowAlreadyRegisteredModal(true)
      } else {
        setError(result.error || 'Error al registrarse')
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setResendTimer(180)
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanOtp = otpCode.trim()
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Por favor ingresa el código completo de 6 dígitos')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanOtp,
        type: 'signup',
      })

      if (error) throw error

      if (data?.session) {
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/login?verified=true'
      }
    } catch (err: unknown) {
      const e = err as Error
      setOtpError(e?.message || 'Código incorrecto o expirado. Verifica los 6 dígitos.')
    } finally {
      setOtpLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="glass-card animate-fade-in" style={{ maxWidth: 440, width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔢</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Ingresa tu código</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Enviamos un código de 6 dígitos a <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>

          {/* Formulario de Código OTP */}
          <form onSubmit={handleVerifyOtp} style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                id="otp-code-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '') // Solo números
                  setOtpCode(val)
                  if (otpError) setOtpError('')
                }}
                autoFocus
                style={{
                  width: '100%',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: otpError ? '2px solid rgba(239, 68, 68, 0.6)' : '2px solid rgba(99, 102, 241, 0.4)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            {otpError && (
              <div style={{
                padding: '0.6rem 0.8rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem',
                background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)'
              }}>
                {otpError}
              </div>
            )}

            <button
              type="submit"
              disabled={otpLoading || otpCode.trim().length !== 6}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                opacity: (otpLoading || otpCode.trim().length !== 6) ? 0.6 : 1,
                cursor: (otpLoading || otpCode.trim().length !== 6) ? 'not-allowed' : 'pointer',
              }}
            >
              {otpLoading ? 'Verificando...' : 'Verificar y Entrar'}
            </button>
          </form>

          {resendMessage && (
            <div style={{
              padding: '0.6rem 0.8rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem',
              background: resendMessage.includes('Error') ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: resendMessage.includes('Error') ? '#fca5a5' : '#6ee7b7',
              border: resendMessage.includes('Error') ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)'
            }}>
              {resendMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendTimer > 0 || resendLoading}
              className="btn-secondary"
              style={{
                width: '100%', padding: '0.7rem', fontSize: '0.85rem',
                opacity: (resendTimer > 0 || resendLoading) ? 0.6 : 1,
                cursor: (resendTimer > 0 || resendLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {resendLoading
                ? 'Reenviando...'
                : resendTimer > 0
                ? `🔄 Reenviar código en (${formatTimer(resendTimer)})`
                : '🔄 Reenviar nuevo código'}
            </button>

            <Link href="/login" style={{ width: '100%', textDecoration: 'none' }}>
              <button type="button" className="btn-secondary" style={{ width: '100%', padding: '0.7rem', fontSize: '0.85rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                Ir al inicio de sesión
              </button>
            </Link>
          </div>

          {/* Mensaje de ayuda con enlace a WhatsApp */}
          <div style={{
            marginTop: '1.5rem',
            padding: '0.85rem 1rem',
            borderRadius: 12,
            background: 'rgba(37,211,102,0.07)',
            border: '1px solid rgba(37,211,102,0.2)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            ¿No te llegó el código ni en SPAM?{' '}
            <a
              href="https://wa.me/593999752932?text=Hola,%20me%20registré%20en%20U-Market%20pero%20no%20me%20llegó%20el%20código%20de%20verificación."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#25d366',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              💬 Contáctanos por WhatsApp
            </a>
            {' '}y te ayudamos al instante.
          </div>
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
                Facultad
              </label>
              <select
                id="register-faculty"
                value={faculty}
                onChange={e => { setFaculty(e.target.value); setCareer('') }}
                className="input-field"
                style={{ background: '#0d1117', color: '#f0f4ff' }}
                required
              >
                <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu facultad...</option>
                {Object.keys(UTA_FACULTY_CAREERS).map(f => (
                  <option key={f} value={f} style={{ background: '#0d1117', color: '#f0f4ff' }}>{f}</option>
                ))}
              </select>
            </div>

            {faculty && (
              <div className="animate-fade-in">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Carrera
                </label>
                <select
                  id="register-career"
                  value={career}
                  onChange={e => setCareer(e.target.value)}
                  className="input-field"
                  style={{ background: '#0d1117', color: '#f0f4ff' }}
                  required
                >
                  <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu carrera...</option>
                  {UTA_FACULTY_CAREERS[faculty].map(c => (
                    <option key={c} value={c} style={{ background: '#0d1117', color: '#f0f4ff' }}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Semestre
              </label>
              <select
                id="register-semester"
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="input-field"
                style={{ background: '#0d1117', color: '#f0f4ff' }}
                required
              >
                <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu semestre...</option>
                {SEMESTERS.map(s => (
                  <option key={s} value={s} style={{ background: '#0d1117', color: '#f0f4ff' }}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Entre 8 y 20 caracteres"
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
                Confirmar contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repite tu contraseña"
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

            {/* Checkbox de Aceptación de Términos y Manejo de Datos (LOPDP) */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              background: 'rgba(99, 102, 241, 0.06)',
              border: acceptedTerms ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
              padding: '0.9rem 1rem',
              borderRadius: 14,
              transition: 'all 0.2s ease',
              marginTop: '0.25rem',
            }}>
              <input
                id="register-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                style={{
                  width: 19,
                  height: 19,
                  accentColor: '#6366f1',
                  cursor: 'pointer',
                  marginTop: 2,
                  flexShrink: 0,
                }}
                required
              />
              <label htmlFor="register-terms" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                Acepto los{' '}
                <Link href="/terminos" target="_blank" style={{ color: '#a5b4fc', fontWeight: 700, textDecoration: 'underline' }}>
                  Términos y Condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/privacidad" target="_blank" style={{ color: '#a5b4fc', fontWeight: 700, textDecoration: 'underline' }}>
                  Política de Privacidad
                </Link>
              </label>
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
              style={{ marginTop: 4, padding: '0.85rem' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                  Registrando...
                </span>
              ) : 'Crear cuenta'}
            </button>
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

      {/* Modal: Cuenta Ya Registrada */}
      {showAlreadyRegisteredModal && typeof window !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowAlreadyRegisteredModal(false)}
        >
          <div 
            className="glass-card animate-fade-in-up" 
            style={{
              maxWidth: 440,
              width: '90%',
              padding: '2.5rem 2rem',
              borderRadius: 24,
              background: '#0d121f',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
              position: 'relative',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowAlreadyRegisteredModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.08)',
                border: 'none', color: 'var(--text-secondary)',
                borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.75rem', color: '#ffffff' }}>
              Esta cuenta ya existe
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              El correo <strong style={{ color: '#ffffff' }}>{email}</strong> ya se encuentra registrado en U-Market. Si es tu cuenta, inicia sesión o recupera tu clave.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link href="/login" style={{ width: '100%', textDecoration: 'none' }}>
                <button className="btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
                  Ir al Inicio de Sesión
                </button>
              </Link>
              <Link href="/forgot-password" style={{ width: '100%', textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ width: '100%', padding: '0.85rem' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
