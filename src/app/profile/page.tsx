'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { UTA_FACULTY_CAREERS, SEMESTERS } from '@/types'
import { useImageUpload } from '@/hooks/useImageUpload'
import { detectFace } from '@/lib/utils'
import { deleteOwnAccountAction } from '@/actions/account'
import { submitVerificationAction, getFeatureFlagAction } from '@/actions/verification'
import VerifiedBadge from '@/components/VerifiedBadge'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [faculty, setFaculty] = useState('')
  const [career, setCareer] = useState('')
  const [semester, setSemester] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [hasLockedAcademicData, setHasLockedAcademicData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [faceChecking, setFaceChecking] = useState(false)

  // Estados para verificación con Carnet UTA
  const [verificationEnabled, setVerificationEnabled] = useState(true)
  const [credentialFile, setCredentialFile] = useState<File | null>(null)
  const [credentialPreview, setCredentialPreview] = useState<string>('')
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const credentialInputRef = useRef<HTMLInputElement>(null)

  const {
    newFiles,
    newPreviews,
    uploading,
    error: uploadError,
    addFiles,
    removeNew,
    upload
  } = useImageUpload({ bucket: 'avatars', maxFiles: 1, maxSizeMB: 2 })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')

      const [{ data, error: profileErr }, { data: contactData }, flagRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, is_active, faculty, semester, is_verified, verification_status, credential_url, verification_rejected_reason, verified_at, verification_submitted_at, rating_avg, review_count, created_at, updated_at')
          .eq('id', user.id)
          .single(),
        supabase.rpc('get_own_contact'),
        getFeatureFlagAction('student_verification_enabled'),
      ])

      setVerificationEnabled(flagRes.enabled ?? false)

      if (profileErr) {
        setError('Error al cargar el perfil')
      } else if (data) {
        setProfile({ ...data, email: user.email } as Profile)
        setEmail(user.email || '')
        setFullName(data.full_name || '')
        setPhone((contactData?.[0]?.phone as string | undefined) ?? '')
        setFaculty(data.faculty || '')
        setCareer(data.semester?.includes(' - ') ? data.semester.split(' - ')[1] : '')
        setSemester(data.semester?.includes(' - ') ? data.semester.split(' - ')[0] : data.semester || '')
        setAvatarUrl(data.avatar_url || '')
        if (data.faculty || data.semester) {
          setHasLockedAcademicData(true)
        }
      }
      setLoading(false)
    }

    fetchProfile()
  }, [router, supabase])

  const handleCredentialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const file = files[0]
    setVerificationError('')
    setVerificationSuccess('')
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setVerificationError('Formato no válido. Sube una captura en formato JPG, PNG o WEBP.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setVerificationError('La imagen es muy pesada (máx 8MB).')
      return
    }

    setCredentialFile(file)
    setCredentialPreview(URL.createObjectURL(file))
  }

  const handleSendVerification = async () => {
    if (!credentialFile) {
      setVerificationError('Por favor selecciona la imagen de tu credencial digital UTA.')
      return
    }

    setSubmittingVerification(true)
    setVerificationError('')
    setVerificationSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', credentialFile)
      formData.append('folder', 'credentials')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || 'Error al subir la credencial')
      }

      const actionRes = await submitVerificationAction(uploadData.url)
      if (!actionRes.success) {
        throw new Error(actionRes.error || 'Error al registrar solicitud')
      }

      setVerificationSuccess('¡Credencial enviada con éxito! El equipo de moderación revisará tu solicitud.')
      setProfile(prev => prev ? {
        ...prev,
        credential_url: uploadData.url,
        verification_status: 'pending',
        verification_rejected_reason: null,
      } : null)
      setCredentialFile(null)
      setCredentialPreview('')
    } catch (err: unknown) {
      const e = err as Error
      setVerificationError(e.message || 'Error al enviar la credencial')
    } finally {
      setSubmittingVerification(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const file = files[0]

    setError('')
    setFaceChecking(true)

    try {
      const { hasFace, supported } = await detectFace(file)

      if (supported && !hasFace) {
        setError('⚠️ No se detectó un rostro humano en la imagen. Por favor, sube una foto tuya con el rostro visible y buena iluminación.')
        setFaceChecking(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (newFiles.length > 0) removeNew(0)
      addFiles([file])
    } catch {
      // Si falla la detección, permitir la subida
      if (newFiles.length > 0) removeNew(0)
      addFiles([file])
    }

    setFaceChecking(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let finalAvatarUrl = avatarUrl

    if (newFiles.length > 0) {
      const urls = await upload()
      if (!urls) {
        setSaving(false)
        return
      }
      finalAvatarUrl = urls[0]
    }

    const updatePayload: {
      phone: string
      avatar_url: string
      full_name?: string
      faculty?: string | null
      semester?: string | null
    } = {
      phone: phone.trim(),
      avatar_url: finalAvatarUrl,
    }

    if (!hasLockedAcademicData) {
      updatePayload.full_name = fullName.trim()
      updatePayload.faculty = faculty || null
      updatePayload.semester = faculty && career && semester ? `${semester} - ${career}` : semester || null
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (updateError) {
      setError('Error al guardar los datos: ' + updateError.message)
    } else {
      if (newFiles.length > 0) setAvatarUrl(finalAvatarUrl)
      if (faculty && semester) setHasLockedAcademicData(true)
      setSuccess('Perfil actualizado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('⚠️ ¿Estás completamente seguro de querer ELIMINAR tu cuenta?\n\nEsta acción borrará irreversiblemente todos tus datos, publicaciones e imágenes. No se puede deshacer.')) return
    
    setSaving(true)
    setError('')
    
    const result = await deleteOwnAccountAction()
    
    if (!result.success) {
      setError('Error al eliminar cuenta: ' + (result.error || 'Inténtalo de nuevo'))
      setSaving(false)
    } else {
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        </main>
      </>
    )
  }

  const displayAvatar = newPreviews.length > 0 ? newPreviews[0] : avatarUrl

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem', maxWidth: 600 }}>

          <div className="animate-fade-in-up" style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 4 }}>
              Mi Perfil
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Gestiona tu información personal y datos de contacto
            </p>
          </div>

          <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2rem' }}>
            
            {/* Avatar Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', fontWeight: 700, color: 'white',
                  overflow: 'hidden', border: '3px solid var(--bg-card)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {displayAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    profile?.full_name?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: 'var(--accent-primary)', color: 'white',
                    border: 'none', borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                  title="Cambiar foto de perfil"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </div>
              {faceChecking ? (
                <div style={{ fontSize: '0.8rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(165,180,252,0.3)', borderTopColor: '#a5b4fc', borderRadius: '50%', display: 'inline-block' }} />
                  Verificando rostro...
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Formatos soportados: JPG, PNG, WEBP. Máx: 2MB.
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  readOnly={hasLockedAcademicData}
                  disabled={hasLockedAcademicData}
                  className="input-field"
                  placeholder="Tu nombre y apellido"
                  style={hasLockedAcademicData ? { opacity: 0.65, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff' } : {}}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Número de WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="+593 99 999 9999"
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Los compradores se contactarán contigo a este número.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Correo institucional
                </label>
                <input
                  type="text"
                  value={email || profile?.email || ''}
                  readOnly
                  disabled
                  className="input-field"
                  style={{ opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Facultad
                </label>
                {hasLockedAcademicData ? (
                  <input
                    type="text"
                    value={faculty}
                    readOnly
                    disabled
                    className="input-field"
                    style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff' }}
                  />
                ) : (
                  <select
                    value={faculty}
                    onChange={e => { setFaculty(e.target.value); setCareer('') }}
                    className="input-field"
                    style={{ background: '#0d1117', color: '#f0f4ff' }}
                  >
                    <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu facultad...</option>
                    {Object.keys(UTA_FACULTY_CAREERS).map(f => (
                      <option key={f} value={f} style={{ background: '#0d1117', color: '#f0f4ff' }}>{f}</option>
                    ))}
                  </select>
                )}
              </div>

              {(faculty || hasLockedAcademicData) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Carrera
                  </label>
                  {hasLockedAcademicData ? (
                    <input
                      type="text"
                      value={career}
                      readOnly
                      disabled
                      className="input-field"
                      style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff' }}
                    />
                  ) : (
                    <select
                      value={career}
                      onChange={e => setCareer(e.target.value)}
                      className="input-field"
                      style={{ background: '#0d1117', color: '#f0f4ff' }}
                    >
                      <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu carrera...</option>
                      {faculty && UTA_FACULTY_CAREERS[faculty]?.map(c => (
                        <option key={c} value={c} style={{ background: '#0d1117', color: '#f0f4ff' }}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Semestre
                </label>
                {hasLockedAcademicData ? (
                  <input
                    type="text"
                    value={semester}
                    readOnly
                    disabled
                    className="input-field"
                    style={{ opacity: 0.65, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)', color: '#f0f4ff' }}
                  />
                ) : (
                  <select
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    className="input-field"
                    style={{ background: '#0d1117', color: '#f0f4ff' }}
                  >
                    <option value="" style={{ background: '#0d1117', color: '#f0f4ff' }}>Selecciona tu semestre...</option>
                    {SEMESTERS.map(s => (
                      <option key={s} value={s} style={{ background: '#0d1117', color: '#f0f4ff' }}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              {(error || uploadError) && (
                <div className="animate-fade-in" style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem',
                  color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>⚠️</span> {error || uploadError}
                </div>
              )}

              {success && (
                <div className="animate-fade-in" style={{
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem',
                  color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>✅</span> {success}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || uploading}
                style={{ marginTop: '0.5rem', padding: '0.9rem' }}
              >
                {(saving || uploading) ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                    Guardando...
                  </span>
                ) : 'Guardar cambios'}
              </button>
            </form>
            
            {/* Módulo de Verificación Estudiantil con Carnet UTA */}
            {verificationEnabled && (
              <div style={{ marginTop: '2.5rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🎓</span> Verificación de Identidad UTA
                  </h3>
                  {profile?.is_verified ? (
                    <VerifiedBadge size="md" showText />
                  ) : profile?.verification_status === 'pending' ? (
                    <span className="badge badge-amber" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⏳ En Revisión</span>
                  ) : profile?.verification_status === 'rejected' ? (
                    <span className="badge badge-red" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>❌ Rechazado</span>
                  ) : (
                    <span className="badge badge-gray" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⚪ No verificado</span>
                  )}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Obtén la <strong>insignia oficial de verificación</strong> subiendo una captura de tu <strong>credencial digital UTA</strong> (carnet universitario). Tu perfil generará mayor confianza y tus publicaciones tendrán mayor visibilidad en el campus.
                </p>

                {profile?.is_verified ? (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.12))',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                    }}>
                      🎓
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#93c5fd', margin: 0 }}>
                        ¡Estudiante Oficial Verificado!
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                        Tu condición de estudiante en la Universidad Técnica de Ambato ha sido comprobada. Tu distintivo es visible en todas tus publicaciones y mensajes.
                      </p>
                    </div>
                  </div>
                ) : profile?.verification_status === 'pending' ? (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.25rem' }}>⏳</span>
                      <strong style={{ color: '#fcd34d', fontSize: '0.9rem' }}>Credencial en proceso de revisión</strong>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#fde68a', margin: 0, lineHeight: 1.5 }}>
                      Hemos recibido la imagen de tu credencial UTA. El equipo de moderación verificará que los datos coincidan y activará tu insignia pronto.
                    </p>
                    {profile.credential_url && (
                      <div style={{ marginTop: 6 }}>
                        <a href={profile.credential_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#93c5fd', textDecoration: 'underline' }}>
                          Ver credencial enviada ↗
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}>
                    {profile?.verification_status === 'rejected' && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 12,
                        padding: '0.85rem 1rem',
                        fontSize: '0.82rem',
                        color: '#fca5a5',
                      }}>
                        <strong>Solicitud anterior no aprobada:</strong> {profile.verification_rejected_reason || 'La imagen no era legible.'} Puedes subir una nueva captura clara a continuación.
                      </div>
                    )}

                    <input
                      ref={credentialInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCredentialFileChange}
                      style={{ display: 'none' }}
                      id="credential-upload-input"
                    />

                    {credentialPreview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={credentialPreview}
                          alt="Previsualización de credencial"
                          style={{
                            maxWidth: 240,
                            maxHeight: 320,
                            borderRadius: 12,
                            border: '2px solid rgba(99, 102, 241, 0.4)',
                            objectFit: 'contain',
                            background: '#0d1117',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => { setCredentialFile(null); setCredentialPreview(''); if (credentialInputRef.current) credentialInputRef.current.value = '' }}
                            className="btn-secondary"
                            disabled={submittingVerification}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                          >
                            Cambiar imagen
                          </button>
                          <button
                            type="button"
                            onClick={handleSendVerification}
                            disabled={submittingVerification}
                            className="btn-primary"
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                          >
                            {submittingVerification ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                                Enviando...
                              </span>
                            ) : (
                              '📤 Enviar credencial para verificación'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => credentialInputRef.current?.click()}
                        style={{
                          background: 'rgba(99, 102, 241, 0.05)',
                          border: '2px dashed rgba(99, 102, 241, 0.3)',
                          borderRadius: 14,
                          padding: '1.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          transition: 'all 0.2s ease',
                          width: '100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)' }}
                      >
                        <span style={{ fontSize: '2rem' }}>🪪</span>
                        <strong style={{ color: '#a5b4fc', fontSize: '0.9rem' }}>Subir captura de Credencial Digital UTA</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Formatos JPG, PNG o WEBP (máx. 8MB)</span>
                      </button>
                    )}

                    {verificationError && (
                      <div className="animate-fade-in" style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#fca5a5',
                      }}>
                        ⚠️ {verificationError}
                      </div>
                    )}

                    {verificationSuccess && (
                      <div className="animate-fade-in" style={{
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#6ee7b7',
                      }}>
                        ✅ {verificationSuccess}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Delete Account Section */}
            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>Zona de Peligro</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Eliminar tu cuenta borrará todos tus datos personales, historial y publicaciones de forma permanente (Cumplimiento GDPR).
              </p>
              <button 
                onClick={handleDeleteAccount}
                disabled={saving}
                className="btn-danger"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                Eliminar mi cuenta permanentemente
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
