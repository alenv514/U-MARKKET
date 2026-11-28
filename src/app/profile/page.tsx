'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { UTA_FACULTY_CAREERS, SEMESTERS } from '@/types'
import { useImageUpload } from '@/hooks/useImageUpload'
import { detectFace, isSyntheticQrEmail } from '@/lib/utils'
import { deleteOwnAccountAction } from '@/actions/account'
import { submitVerificationAction, verifyStudentQrAction, getFeatureFlagAction } from '@/actions/verification'
import VerifiedBadge from '@/components/VerifiedBadge'
import Icon from '@/components/Icon'
import UtaCredentialQrPicker from '@/components/UtaCredentialQrPicker'
import { computeReputation } from '@/lib/reputation'

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
  const [verifyingQr, setVerifyingQr] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [badgeNotice, setBadgeNotice] = useState('')
  const [activeListingCount, setActiveListingCount] = useState(0)
  const [bookListingCount, setBookListingCount] = useState(0)

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

      const [{ data, error: profileErr }, { data: contactData }, flagRes, { data: activeListingsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, is_active, faculty, semester, is_verified, verification_status, credential_url, verification_rejected_reason, verified_at, verification_submitted_at, rating_avg, review_count, created_at, updated_at')
          .eq('id', user.id)
          .single(),
        supabase.rpc('get_own_contact'),
        getFeatureFlagAction('student_verification_enabled'),
        supabase
          .from('listings')
          .select('category')
          .eq('seller_id', user.id)
          .eq('status', 'active'),
      ])

      const activeList = activeListingsData ?? []
      setActiveListingCount(activeList.length)
      setBookListingCount(activeList.filter(item => item.category === 'Libros y Apuntes').length)

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

  const handleProfileQrDecoded = async (qrUrl: string, file?: File) => {
    setVerifyingQr(true)
    setVerificationError('')
    setVerificationSuccess('')

    try {
      const res = await verifyStudentQrAction(qrUrl)
      if (res.success) {
        setVerificationSuccess('¡Estudiante verificado al instante mediante código QR oficial de la UTA!')
        setProfile(prev => prev ? {
          ...prev,
          full_name: res.officialName || prev.full_name,
          is_verified: true,
          verification_status: 'approved',
          verification_rejected_reason: null,
        } : null)
        if (res.officialName) setFullName(res.officialName)
        setCredentialFile(null)
        setCredentialPreview('')
        return
      }

      if (res.needManualReview && file) {
        setCredentialFile(file)
        setCredentialPreview(URL.createObjectURL(file))
      }
      setVerificationError(res.error || 'No se pudo verificar la credencial con el código QR.')
    } catch {
      setVerificationError('Error al validar el código QR con el servidor de la UTA.')
    } finally {
      setVerifyingQr(false)
    }
  }

  const handleProfileFileFallback = (file: File) => {
    setVerificationError(
      'No se pudo leer el código QR automáticamente en esta imagen. Puedes enviarla para revisión manual del equipo.'
    )
    setVerificationSuccess('')
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
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const formData = new FormData()
      formData.append('file', credentialFile)
      formData.append('folder', 'credentials')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        headers,
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
        setError('No se detectó un rostro humano en la imagen. Por favor, sube una foto tuya con el rostro visible y buena iluminación.')
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
    if (!confirm('¿Estás completamente seguro de querer ELIMINAR tu cuenta?\n\nEsta acción borrará irreversiblemente todos tus datos, publicaciones e imágenes. No se puede deshacer.')) return
    
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

  const lockedFieldStyle = {
    cursor: 'not-allowed',
    background: '#f8fafc',
    color: '#334155',
    WebkitTextFillColor: '#334155',
    borderColor: '#e2e8f0',
  } as const

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
                  background: 'linear-gradient(135deg, #00345e, #004b87)',
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
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </div>
              {faceChecking ? (
                <div style={{ fontSize: '0.8rem', color: '#00345e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(0,52,94,0.2)', borderTopColor: '#00345e', borderRadius: '50%', display: 'inline-block' }} />
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
                  readOnly={hasLockedAcademicData || Boolean(profile?.is_verified)}
                  disabled={hasLockedAcademicData || Boolean(profile?.is_verified)}
                  className="input-field"
                  placeholder="Tu nombre y apellido"
                  style={(hasLockedAcademicData || profile?.is_verified) ? lockedFieldStyle : undefined}
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
                  {isSyntheticQrEmail(email || profile?.email) ? 'Acceso de cuenta' : 'Correo institucional'}
                </label>
                <input
                  type="text"
                  value={isSyntheticQrEmail(email || profile?.email) ? 'Ingreso por Cédula (Credencial Digital UTA)' : (email || profile?.email || '')}
                  readOnly
                  disabled
                  className="input-field"
                  style={lockedFieldStyle}
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
                    style={lockedFieldStyle}
                  />
                ) : (
                  <select
                    value={faculty}
                    onChange={e => { setFaculty(e.target.value); setCareer('') }}
                    className="input-field"
                  >
                    <option value="">Selecciona tu facultad...</option>
                    {Object.keys(UTA_FACULTY_CAREERS).map(f => (
                      <option key={f} value={f}>{f}</option>
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
                      style={lockedFieldStyle}
                    />
                  ) : (
                    <select
                      value={career}
                      onChange={e => setCareer(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Selecciona tu carrera...</option>
                      {faculty && UTA_FACULTY_CAREERS[faculty]?.map(c => (
                        <option key={c} value={c}>{c}</option>
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
                    style={lockedFieldStyle}
                  />
                ) : (
                  <select
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Selecciona tu semestre...</option>
                    {SEMESTERS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              {(error || uploadError) && (
                <div className="animate-fade-in" style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem',
                  color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Icon name="alert" size={16} style={{ flexShrink: 0 }} /> {error || uploadError}
                </div>
              )}

              {success && (
                <div className="animate-fade-in" style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem',
                  color: '#00345e', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Icon name="checkCircle" size={16} style={{ flexShrink: 0 }} /> {success}
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
            {(verificationEnabled || profile?.is_verified) && (
              <div id="verificacion-uta" style={{ marginTop: '2.5rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="graduation" size={20} style={{ color: '#00345e' }} /> Verificación de Identidad UTA
                  </h3>
                  {profile?.is_verified ? (
                    <VerifiedBadge size="md" showText />
                  ) : profile?.verification_status === 'pending' ? (
                    <span className="badge badge-amber" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="clock" size={13} /> En Revisión
                    </span>
                  ) : profile?.verification_status === 'rejected' ? (
                    <span className="badge badge-red" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="xCircle" size={13} /> Rechazado
                    </span>
                  ) : (
                    <span className="badge" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="circleDot" size={13} /> No verificado
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Obtén la <strong>insignia oficial de verificación al instante</strong> escaneando o subiendo tu <strong>credencial digital UTA</strong> (el QR valida tu matrícula vigente y previene cuentas duplicadas por cédula).
                </p>

                {profile?.is_verified ? (
                  <div style={{
                    background: 'rgba(0, 52, 94, 0.05)',
                    border: '1px solid rgba(0, 52, 94, 0.18)',
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
                      background: 'linear-gradient(135deg, #00345e, #004b87)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="graduation" size={22} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00345e', margin: 0 }}>
                        ¡Estudiante Oficial Verificado!
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                        Tu condición de estudiante en la Universidad Técnica de Ambato ha sido comprobada. Tu distintivo es visible en todas tus publicaciones y mensajes.
                      </p>
                    </div>
                  </div>
                ) : profile?.verification_status === 'pending' ? (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="clock" size={20} style={{ color: '#0a192f', flexShrink: 0 }} />
                      <strong style={{ color: '#0a192f', fontSize: '0.9rem' }}>Credencial en proceso de revisión</strong>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                      Hemos recibido la imagen de tu credencial UTA. El equipo de moderación verificará que los datos coincidan y activará tu insignia pronto.
                    </p>
                    {profile.credential_url && (
                      <div style={{ marginTop: 6 }}>
                        <a href={profile.credential_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#00345e', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Ver credencial enviada <Icon name="arrowUpRight" size={14} />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}>
                    {profile?.verification_status === 'rejected' && (
                      <div style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 12,
                        padding: '0.85rem 1rem',
                        fontSize: '0.82rem',
                        color: '#b91c1c',
                      }}>
                        <strong>Solicitud anterior no aprobada:</strong> {profile.verification_rejected_reason || 'La imagen no era legible.'} Puedes subir una nueva captura clara a continuación.
                      </div>
                    )}

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
                            border: '2px solid rgba(0, 52, 94, 0.25)',
                            objectFit: 'contain',
                            background: '#ffffff',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => { setCredentialFile(null); setCredentialPreview(''); setVerificationError('') }}
                            className="btn-secondary"
                            disabled={submittingVerification}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                          >
                            Volver / reintentar QR
                          </button>
                          <button
                            type="button"
                            onClick={handleSendVerification}
                            disabled={submittingVerification}
                            className="btn-primary"
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            {submittingVerification ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                                Enviando...
                              </span>
                            ) : (
                              <>
                                <Icon name="send" size={14} /> Enviar credencial para verificación manual
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <UtaCredentialQrPicker
                        onQrDecoded={handleProfileQrDecoded}
                        onFileWithoutQr={handleProfileFileFallback}
                        busy={verifyingQr}
                        title="Verificar al instante con tu Carnet Digital UTA"
                        subtitle="Sube una captura del carnet o escanea el QR con la cámara. Si el QR es legible, tu cuenta se verifica al momento."
                      />
                    )}

                    {verificationError && (
                      <div className="animate-fade-in" style={{
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#b91c1c',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Icon name="alert" size={15} style={{ flexShrink: 0 }} /> {verificationError}
                      </div>
                    )}

                    {verificationSuccess && (
                      <div className="animate-fade-in" style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe',
                        borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#00345e',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Icon name="checkCircle" size={15} style={{ flexShrink: 0 }} /> {verificationSuccess}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Módulo de Reputación y Logros UTA */}
            {profile && (() => {
              const rep = computeReputation(profile, {
                activeListings: activeListingCount,
                bookListings: bookListingCount,
              })
              const badgeActionMeta: Record<string, { label: string; onClick: () => void }> = {
                verified: {
                  label: 'Subir carnet',
                  onClick: () => {
                    const section = document.getElementById('verificacion-uta')
                    if (section) {
                      setBadgeNotice('')
                      section.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    } else {
                      setBadgeNotice('La verificación con carnet UTA será habilitada pronto por administración.')
                    }
                  },
                },
                five_stars: {
                  label: 'Ver reseñas',
                  onClick: () => router.push(`/profile/${profile.id}#resenas`),
                },
                frequent: {
                  label: 'Ir a Mi Panel',
                  onClick: () => router.push('/dashboard'),
                },
                books: {
                  label: 'Publicar libro',
                  onClick: () => router.push('/listings/new?category=Libros%20y%20Apuntes'),
                },
                active: {
                  label: 'Publicar ahora',
                  onClick: () => router.push('/listings/new'),
                },
              }
              return (
                <div style={{ marginTop: '2.5rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="trophy" size={20} style={{ color: '#00345e' }} /> Tu Nivel de Confianza y Logros
                    </h3>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: rep.badgeColor,
                      background: `${rep.badgeColor}15`,
                      border: `1px solid ${rep.badgeColor}30`,
                      padding: '3px 10px',
                      borderRadius: 99,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Icon name={rep.badgeIcon} size={13} />
                      {rep.badgeLabel}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    En U-Market la reputación es gratuita y se gana con actividad y honestidad. Cuanto mayor sea tu nivel, más rápido venderás en tu campus.
                  </p>

                  <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>
                      <span>Nivel {rep.level}: {rep.levelName}</span>
                      <span style={{ color: rep.badgeColor }}>{rep.progressPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${rep.progressPercent}%`, height: '100%', background: `linear-gradient(90deg, #00345e, ${rep.badgeColor})`, borderRadius: 999, transition: 'width 0.4s' }} />
                    </div>
                    {rep.nextLevelName && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Próximo nivel:</span>
                        {rep.nextLevelIcon && <Icon name={rep.nextLevelIcon} size={13} />}
                        <strong>{rep.nextLevelName}</strong>
                      </p>
                    )}
                  </div>

                  {/* Vitrina de Logros */}
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Insignias y Medallas Universitarias
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Toca cualquier insignia para ir al apartado donde puedes conseguirla o revisarla.
                  </p>
                  {badgeNotice && (
                    <div style={{
                      marginBottom: 12,
                      padding: '0.65rem 0.9rem',
                      borderRadius: 10,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#00345e',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <Icon name="alert" size={15} style={{ flexShrink: 0 }} />
                      <span>{badgeNotice}</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    {rep.badges.map(b => {
                      const action = badgeActionMeta[b.id]
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={action?.onClick}
                          className="achievement-btn"
                          style={{
                            background: b.unlocked ? '#ffffff' : '#f8fafc',
                            border: b.unlocked ? `1px solid ${rep.badgeColor}40` : '1px solid #cbd5e1',
                            borderRadius: 12,
                            padding: '12px 8px',
                            textAlign: 'center',
                            opacity: b.unlocked ? 1 : 0.88,
                            boxShadow: b.unlocked ? `0 2px 8px ${rep.badgeColor}15` : '0 1px 3px rgba(0, 52, 94, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '100%',
                          }}
                          title={`${b.description}${action ? ` — ${action.label}` : ''}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, color: b.unlocked ? rep.badgeColor : '#64748b' }}>
                            <Icon name={b.icon} size={24} />
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: b.unlocked ? 'var(--text-primary)' : '#0a192f' }}>
                            {b.title}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: b.unlocked ? rep.badgeColor : 'var(--text-muted)', marginTop: 4, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {b.unlocked ? (
                              <>
                                <Icon name="checkCircle" size={11} /> Desbloqueado
                              </>
                            ) : (
                              <>
                                <Icon name="lock" size={11} /> Pendiente
                              </>
                            )}
                          </div>
                          {action && (
                            <span style={{
                              marginTop: 7,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              color: '#00345e',
                              background: 'rgba(0, 52, 94, 0.08)',
                              padding: '3px 8px',
                              borderRadius: 99,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}>
                              {action.label} <Icon name="arrowUpRight" size={11} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            
            {/* Delete Account Section */}
            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>Zona de Peligro</h3>
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
