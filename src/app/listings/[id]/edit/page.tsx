'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/types'
import type { Listing } from '@/types'
import { sanitize, isValidPrice, isValidEcuadorPhone } from '@/lib/utils'
import { useImageUpload } from '@/hooks/useImageUpload'

const MAX_PHOTOS = 1

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Otros')
  const [whatsapp, setWhatsapp] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const {
    existingUrls,
    setExistingUrls,
    newFiles,
    newPreviews,
    uploading,
    progress,
    error: uploadError,
    addFiles,
    removeExisting,
    removeNew,
    upload
  } = useImageUpload({ bucket: 'listings', maxFiles: MAX_PHOTOS, maxSizeMB: 5 })

  const fetchListing = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error: fetchErr } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .eq('seller_id', user.id) // Solo el dueño puede editar
      .single()

    if (fetchErr || !data) { setNotFound(true); setLoading(false); return }

    const listing = data as Listing
    setTitle(listing.title)
    setDescription(listing.description ?? '')
    setPrice(listing.price.toString())
    setCategory(listing.category)
    setWhatsapp(listing.whatsapp_number ?? '')
    // Priorizar el array images, sino usar image_url
    setExistingUrls(
      listing.image_url ? [listing.image_url] : []
    )
    setLoading(false)
  }, [id, router, setExistingUrls, supabase])

  useEffect(() => {
    let active = true
    const load = async () => {
      await fetchListing()
    }
    if (active) {
      load()
    }
    return () => { active = false }
  }, [fetchListing])

  const handleNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (!isValidPrice(price)) {
      setError('Ingresa un precio válido (máx. $100.000)'); return
    }
    if (whatsapp.trim() && !isValidEcuadorPhone(whatsapp)) {
      setError('Formato de WhatsApp inválido. Usa +593XXXXXXXXX o 09XXXXXXXX'); return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesión expirada'); setSaving(false); return }

    // Subir nuevas imágenes y unificar con las existentes no eliminadas
    const allImages = await upload()
    
    if (!allImages) {
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update({
        title: sanitize(title),
        description: description.trim() ? sanitize(description) : null,
        price: Number(price),
        category,
        whatsapp_number: whatsapp.trim() || null,
        image_url: allImages[0] ?? null,
      })
      .eq('id', id)
      .eq('seller_id', user.id)

    if (updateError) {
      setError('Error guardando: ' + updateError.message)
      setSaving(false)
      return
    }

    router.push(`/listings/${id}`)
  }

  const totalPhotos = existingUrls.length + newFiles.length
  const categories = CATEGORIES.filter(c => c !== 'Todos')

  // ── Estados de carga ──
  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh' }}>
          <div className="page-container" style={{ paddingTop: '3rem', maxWidth: 680 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: '1rem' }} />
            ))}
          </div>
        </main>
      </>
    )
  }

  if (notFound) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>No tienes permiso para editar esta publicación</h2>
            <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ marginTop: '1rem' }}>
              Volver al dashboard
            </button>
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
              Editar publicación ✏️
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Actualiza los datos de tu producto o servicio
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── Gestión de fotos ── */}
            <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  📸 Fotos
                  <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>
                    ({totalPhotos}/{MAX_PHOTOS})
                  </span>
                </label>
                {totalPhotos < MAX_PHOTOS && (
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

              {totalPhotos === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 12,
                    padding: '2rem', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.3s ease', background: 'rgba(99,102,241,0.03)',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#6366f1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 6 }}>📸</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Subir fotos</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hasta {MAX_PHOTOS} fotos · máx. 5MB cada una</div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '0.75rem',
                }}>
                  {/* Imágenes existentes */}
                  {existingUrls.map((src, i) => (
                    <div key={`ex-${i}`} style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden',
                      border: (i === 0 && newFiles.length === 0) ? '2px solid #6366f1' : '2px solid var(--border)',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {i === 0 && newFiles.length === 0 && (
                        <div style={{ position: 'absolute', top: 4, left: 4, background: '#6366f1', borderRadius: 999, padding: '1px 8px', fontSize: '0.6rem', fontWeight: 700, color: 'white' }}>
                          Portada
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExisting(i)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
                          width: 22, height: 22, cursor: 'pointer', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
                        }}
                      >✕</button>
                    </div>
                  ))}

                  {/* Nuevas fotos pendientes de subir */}
                  {newPreviews.map((src, i) => (
                    <div key={`new-${i}`} style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden',
                      border: '2px dashed #6366f1',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`nueva ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(99,102,241,0.85)', borderRadius: 999, padding: '1px 8px', fontSize: '0.6rem', fontWeight: 700, color: 'white' }}>
                        Nueva
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNew(i)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
                          width: 22, height: 22, cursor: 'pointer', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
                        }}
                      >✕</button>
                    </div>
                  ))}

                  {/* Botón + agregar más (dentro del grid) */}
                  {totalPhotos < MAX_PHOTOS && (
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
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                multiple
                onChange={handleNewImages}
                style={{ display: 'none' }}
              />
            </div>

            {/* ── Campos del formulario ── */}
            <div className="glass-card animate-fade-in-up delay-200" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '1.25rem' }}>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Título <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input-field"
                  maxLength={100}
                  required
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{title.length}/100</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Descripción
                </label>
                <textarea
                  id="edit-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-field"
                  rows={4}
                  maxLength={1000}
                  style={{ resize: 'vertical' }}
                  placeholder="Describe tu producto o servicio..."
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{description.length}/1000</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Precio (USD) <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                    <input
                      id="edit-price"
                      type="number"
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
                    id="edit-category"
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
                  id="edit-whatsapp"
                  type="tel"
                  placeholder="+593 99 999 9999"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            {/* Error */}
            {(error || uploadError) && (
              <div className="animate-fade-in" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.85rem',
                color: '#fca5a5', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠️</span> {error || uploadError}
              </div>
            )}

            {/* Botones */}
            <div className="animate-fade-in-up delay-300" style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              {/* Barra de progreso */}
              {(saving || uploading) && newFiles.length > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 999, overflow: 'hidden', height: 6 }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    transition: 'width 0.3s ease', borderRadius: 999,
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
                  id="edit-submit"
                  type="submit"
                  className="btn-primary"
                  disabled={saving || uploading}
                  style={{ flex: 2, padding: '0.9rem' }}
                >
                  {(saving || uploading) ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                      {uploading ? `Subiendo... ${progress}%` : 'Guardando...'}
                    </span>
                  ) : '💾 Guardar cambios'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}
