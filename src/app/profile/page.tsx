'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { UTA_FACULTY_CAREERS, SEMESTERS } from '@/types'
import { useImageUpload } from '@/hooks/useImageUpload'
import { detectFace } from '@/lib/utils'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [faculty, setFaculty] = useState('')
  const [career, setCareer] = useState('')
  const [semester, setSemester] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [faceChecking, setFaceChecking] = useState(false)

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
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        setError('Error al cargar el perfil')
      } else if (data) {
        setProfile(data as Profile)
        setFullName(data.full_name || '')
        setPhone(data.phone || '')
        setFaculty(data.faculty || '')
        setCareer(data.semester?.includes(' - ') ? data.semester.split(' - ')[1] : '')
        setSemester(data.semester?.includes(' - ') ? data.semester.split(' - ')[0] : data.semester || '')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }

    fetchProfile()
  }, [router])

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

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        avatar_url: finalAvatarUrl,
        faculty: faculty || null,
        // Guardamos semestre y carrera juntos: "5to semestre - Ingeniería de Software"
        semester: faculty && career && semester ? `${semester} - ${career}` : semester || null,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Error al guardar los datos: ' + updateError.message)
    } else {
      if (newFiles.length > 0) setAvatarUrl(finalAvatarUrl)
      setSuccess('Perfil actualizado correctamente')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('⚠️ ¿Estás completamente seguro de querer ELIMINAR tu cuenta?\n\nEsta acción borrará irreversiblemente todos tus datos, publicaciones e imágenes. No se puede deshacer.')) return
    
    setSaving(true)
    setError('')
    
    const { error: deleteError } = await supabase.rpc('delete_user')
    
    if (deleteError) {
      setError('Error al eliminar cuenta: ' + deleteError.message)
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
                  className="input-field"
                  placeholder="Tu nombre y apellido"
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
                  value={profile?.email || ''}
                  readOnly
                  className="input-field"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Facultad
                </label>
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
              </div>

              {faculty && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Carrera
                  </label>
                  <select
                    value={career}
                    onChange={e => setCareer(e.target.value)}
                    className="input-field"
                    style={{ background: '#0d1117', color: '#f0f4ff' }}
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
