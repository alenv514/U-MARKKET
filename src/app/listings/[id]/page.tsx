'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ImageCarousel from '@/components/ImageCarousel'
import StarRating from '@/components/StarRating'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Link from 'next/link'
import { sanitize } from '@/lib/utils'
import { getOrCreateChat } from '@/lib/chat'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [contacting, setContacting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))

    const fetch = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating_avg, review_count)')
        .eq('id', id)
        .single()

      if (data) {
        setListing(data as Listing)
        // Incrementar vistas
        await supabase.from('listings').update({ views: (data.views ?? 0) + 1 }).eq('id', id)
      }
      setLoading(false)
    }
    fetch()
  }, [id])

  const handleReport = async () => {
    if (!userId) { alert('Debes iniciar sesión para reportar'); return }
    const reason = prompt('¿Por qué reportas esta publicación?')
    if (!reason) return
    const safeReason = sanitize(reason).slice(0, 500)
    const { error } = await supabase.from('reports').insert({ listing_id: id, reporter_id: userId, reason: safeReason })
    if (error?.code === '23505') alert('Ya reportaste esta publicación')
    else if (!error) alert('Reporte enviado. Gracias!')
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh' }}>
          <div className="page-container" style={{ paddingTop: '3rem', maxWidth: 800 }}>
            <div className="skeleton" style={{ height: 400, borderRadius: 16, marginBottom: '1.5rem' }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          </div>
        </main>
      </>
    )
  }

  if (!listing) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Publicación no encontrada</h2>
            <Link href="/"><button className="btn-primary">Volver al inicio</button></Link>
          </div>
        </main>
      </>
    )
  }

  const handleContact = async () => {
    if (!userId) {
      router.push('/login')
      return
    }

    setContacting(true)

    // Check or Create chat
    const chatId = await getOrCreateChat(supabase, listing.id, userId, listing.seller_id)

    if (!chatId) {
      alert('Error al iniciar conversación')
      setContacting(false)
      return
    }

    router.push(`/inbox/${chatId}`)
  }

  const isSeller = userId === listing.seller_id

  const formatPrice = (p: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(p)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2rem', maxWidth: 1000 }}>

          {/* Back */}
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.875rem', marginBottom: '1.5rem', padding: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Volver
          </button>

          {/* Status banner */}
          {listing.status === 'pending_approval' && (
            <div style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 12,
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#a5b4fc'
            }}>
              <span style={{ fontSize: '1.25rem' }}>⏳</span>
              <div>
                <strong style={{ display: 'block', color: 'white', fontSize: '0.9rem' }}>Publicación en revisión</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Esta publicación solo es visible para ti. Estará disponible públicamente una vez que el administrador la apruebe.</span>
              </div>
            </div>
          )}

          <div className="listing-detail-grid">

            {/* Carousel */}
            <div className="glass-card animate-fade-in-up" style={{ overflow: 'hidden', position: 'relative' }}>
              <ImageCarousel
                images={listing.image_url ? [listing.image_url] : []}
                title={listing.title}
                compact={false}
                interval={4000}
              />
              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
                <span className="badge badge-indigo">{listing.category}</span>
              </div>
            </div>

            {/* Info */}
            <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, lineHeight: 1.2 }}>{listing.title}</h1>
                <span className="price-tag" style={{ fontSize: '1.75rem', flexShrink: 0 }}>{formatPrice(listing.price)}</span>
              </div>

              {listing.description && (
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                  {listing.description}
                </p>
              )}

              <div className="divider" />

              {/* Seller */}
              {listing.profiles && (
                <Link href={`/profile/${listing.seller_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '12px', transition: 'background 0.2s' }}
                       onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', fontWeight: 700, color: 'white', flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {listing.profiles.avatar_url ? (
                        <img src={listing.profiles.avatar_url} alt="avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                      ) : (
                        listing.profiles.full_name?.[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{listing.profiles.full_name || 'Vendedor UTA'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <StarRating rating={Number(listing.profiles.rating_avg || 0)} size={12} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({listing.profiles.review_count || 0})</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{listing.views} vistas</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!isSeller && (
                  <button 
                    onClick={handleContact}
                    disabled={contacting}
                    className="btn-primary" 
                    style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '0.9rem' }}
                  >
                    {contacting ? 'Conectando...' : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Enviar Mensaje
                      </>
                    )}
                  </button>
                )}

                {isSeller && (
                  <Link href={`/listings/${listing.id}/edit`} style={{ flex: 1 }}>
                    <button className="btn-secondary" style={{ width: '100%' }}>✏️ Editar publicación</button>
                  </Link>
                )}

                {!isSeller && userId && (
                  <button onClick={handleReport} className="btn-secondary" style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    Reportar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
