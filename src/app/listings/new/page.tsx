'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/types'
import { sanitize, isValidPrice, isValidEcuadorPhone, checkBannedWords } from '@/lib/utils'
import { useImageUpload } from '@/hooks/useImageUpload'

const MAX_PHOTOS = 1

export default function NewListingPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Otros')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialCheckLoading, setInitialCheckLoading] = useState(true)
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | 'admin' | null>(null)
  const [freePublishingMode, setFreePublishingMode] = useState(false)
  const [requireApproval, setRequireApproval] = useState(false)
  const [userIsActive, setUserIsActive] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const {
    newFiles,
    newPreviews,
    uploading,
    progress,
    error: uploadError,
    addFiles,
    removeNew,
    upload
  } = useImageUpload({ bucket: 'listings', maxFiles: MAX_PHOTOS, maxSizeMB: 5 })

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email ?? '')

      const [profileRes, settingsRes, approvalSettingsRes] = await Promise.all([
        supabase.from('profiles').select('role, is_active').eq('id', user.id).single(),
        supabase.from('platform_settings').select('value').eq('key', 'free_publishing_mode').single(),
        supabase.from('platform_settings').select('value').eq('key', 'listings_require_approval').single()
      ])

      setUserRole(profileRes.data?.role ?? 'buyer')
      setUserIsActive(profileRes.data?.is_active !== false)
      setFreePublishingMode(settingsRes.data?.value === true || settingsRes.data?.value === 'true')
      setRequireApproval(approvalSettingsRes.data?.value === true || approvalSettingsRes.data?.value === 'true')
      setInitialCheckLoading(false)
    }
    checkRole()
  }, [router, supabase])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (!isValidPrice(price)) { setError('Ingresa un precio válido (máx. $100.000)'); return }
    
    // Validar censura automática
    const titleCheck = checkBannedWords(title)
    if (titleCheck.hasBanned) {
      setError(`El título contiene vocabulario no permitido en la plataforma ("${titleCheck.word}"). Evita contenido inapropiado o fraudulento.`)
      return
    }
    const descCheck = checkBannedWords(description)
    if (descCheck.hasBanned) {
      setError(`La descripción contiene vocabulario no permitido en la plataforma ("${descCheck.word}"). Evita contenido inapropiado o fraudulento.`)
      return
    }

    if (whatsapp.trim() && !isValidEcuadorPhone(whatsapp)) {
      setError('Formato de WhatsApp inválido. Usa +593XXXXXXXXX o 09XXXXXXXX'); return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Debes iniciar sesión'); setLoading(false); return }

    if (!freePublishingMode) {
      // Verificar suscripción activa (solo para doble seguridad, aunque ya pasaron el filtro visual de rol)
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (!sub || (sub.ends_at && new Date(sub.ends_at) < new Date())) {
        setError('Tu suscripción como vendedor ha expirado o no está activa.')
        setLoading(false)
        return
      }
    }

    let imageUrls: string[] = []

    // Subir múltiples imágenes
    if (newFiles.length > 0) {
      const urls = await upload()
      if (!urls) {
        setLoading(false)
        return
      }
      imageUrls = urls
    }

    // Crear listing con array de imágenes
    const finalStatus = requireApproval ? 'pending_approval' : 'active'

    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        seller_id: user.id,
        title: sanitize(title),
        description: description.trim() ? sanitize(description) : null,
        price: Number(price),
        category,
        image_url: imageUrls[0] ?? null,
        whatsapp_number: whatsapp.trim() || null,
        status: finalStatus,
      })
      .select()
      .single()

    if (insertError) {
      setError('Error al crear la publicación: ' + insertError.message)
      setLoading(false)
      return
    }

    if (requireApproval) {
      alert('¡Publicación creada con éxito! Se ha enviado a revisión por el administrador antes de ser pública.')
      router.push('/dashboard')
    } else {
      router.push(`/listings/${listing.id}`)
    }
  }

  const categories = CATEGORIES.filter(c => c !== 'Todos')

  if (initialCheckLoading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        </main>
      </>
    )
  }

  // --- UI DE SUSPENSIÓN (Cumpliendo Regla 4: no crear archivos nuevos innecesarios) ---
  if (!initialCheckLoading && userIsActive === false) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="page-container glass-card animate-fade-in-up" style={{ maxWidth: 500, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-red)', marginBottom: '1rem' }}>
              Cuenta Suspendida
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tu cuenta ha sido suspendida temporal o permanentemente por infringir las normas de la comunidad o publicar contenido no permitido en U-Market.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Si crees que esto es un error, por favor ponte en contacto con el soporte administrativo de la plataforma.
            </p>
          </div>
        </main>
      </>
    )
  }

  // --- UI DE UPGRADE INLINE (Cumpliendo Regla 4: no crear archivos nuevos innecesarios) ---
  if (userRole === 'buyer' && !freePublishingMode) {
    const waMessage = encodeURIComponent(`Hola, quiero ser vendedor en U-Market. Mi correo de registro es: ${userEmail}`)
    const waLink = `https://wa.me/593999752932?text=${waMessage}`

    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '4rem' }}>
          <div className="page-container glass-card animate-fade-in-up" style={{ maxWidth: 500, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '1rem' }}>
              Conviértete en Vendedor
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Para mantener la calidad y seguridad de nuestra comunidad universitaria, publicar productos requiere una suscripción verificada.
            </p>

            <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>
                $5.00 <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ mes</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>✅ Publicaciones ilimitadas</li>
                <li>✅ Contacto directo por WhatsApp</li>
                <li>✅ Soporte prioritario</li>
              </ul>
            </div>

            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '1rem 2rem', fontSize: '1.1rem', textDecoration: 'none', background: '#25D366' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Solicitar por WhatsApp
            </a>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem', maxWidth: 680 }}>

          {/* Header */}
          <div className="animate-fade-in-up" style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 4 }}>
              Nueva publicación ✨
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Completa los datos de tu producto o servicio
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Multi-image upload */}
            <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  📸 Fotos del producto
                  <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>
                    ({newFiles.length}/{MAX_PHOTOS})
                  </span>
                </label>
                {newFiles.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                    style={{ padding: '5px 14px', fontSize: '0.78rem' }}
                  >
                    + Agregar foto
                  </button>
                )}
              </div>

              {/* Preview grid */}
              {newPreviews.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  {newPreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: i === 0 ? '2px solid #6366f1' : '2px solid var(--border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {i === 0 && (
                        <div style={{ position: 'absolute', top: 4, left: 4, background: '#6366f1', borderRadius: 999, padding: '1px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>
                          Portada
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeNew(i)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                          width: 22, height: 22, cursor: 'pointer', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Botón agregar más (dentro del grid) */}
                  {newFiles.length < MAX_PHOTOS && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        aspectRatio: '1', borderRadius: 10, border: '2px dashed var(--border)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', gap: 4, transition: 'all 0.2s',
                        background: 'rgba(99,102,241,0.03)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <span style={{ fontSize: '1.5rem' }}>+</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>foto</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Drop zone inicial */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 12, padding: '2.5rem',
                    textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: 'rgba(99,102,241,0.03)',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#6366f1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📸</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Haz clic para subir fotos</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hasta {MAX_PHOTOS} fotos · JPG, PNG, WEBP · máx. 5MB cada una</div>
                </div>
              )}

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                💡 La primera foto será la portada y aparecerá primero en el carrusel
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Form fields */}
            <div className="glass-card animate-fade-in-up delay-200" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '1.25rem' }}>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Título <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  id="listing-title"
                  type="text"
                  placeholder="ej: Laptop HP Core i5, Clases de inglés..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input-field"
                  maxLength={100}
                  required
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                  {title.length}/100
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Descripción
                </label>
                <textarea
                  id="listing-description"
                  placeholder="Describe tu producto o servicio con detalle..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-field"
                  rows={4}
                  maxLength={1000}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                  {description.length}/1000
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Precio (USD) <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                    <input
                      id="listing-price"
                      type="number"
                      placeholder="0.00"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '2rem' }}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Categoría
                  </label>
                  <select
                    id="listing-category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="input-field"
                    style={{ cursor: 'pointer' }}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat} style={{ background: '#0d1117' }}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  WhatsApp de contacto
                </label>
                <input
                  id="listing-whatsapp"
                  type="tel"
                  placeholder="+593 99 999 9999"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="input-field"
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Los compradores te contactarán por WhatsApp
                </p>
              </div>
            </div>

            {(error || uploadError) && (
              <div className="animate-fade-in" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '0.75rem 1rem',
                fontSize: '0.85rem', color: '#fca5a5', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠️</span> {error || uploadError}
              </div>
            )}

            <div className="animate-fade-in-up delay-300" style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              {/* Barra de progreso de subida */}
              {(loading || uploading) && newFiles.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 999, overflow: 'hidden', height: 6 }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    transition: 'width 0.3s ease',
                    borderRadius: 999,
                  }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  id="listing-submit"
                  type="submit"
                  className="btn-primary"
                  disabled={loading || uploading}
                  style={{ flex: 2, padding: '0.9rem' }}
                >
                  {(loading || uploading) ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                      {uploading ? `Subiendo fotos... ${progress}%` : 'Publicando...'}
                    </span>
                  ) : `🚀 Publicar${newFiles.length > 0 ? ` con ${newFiles.length} foto${newFiles.length > 1 ? 's' : ''}` : ''}`}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
