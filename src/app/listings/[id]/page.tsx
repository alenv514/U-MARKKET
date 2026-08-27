'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ImageCarousel from '@/components/ImageCarousel'
import StarRating from '@/components/StarRating'
import VerifiedBadge from '@/components/VerifiedBadge'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types'
import Link from 'next/link'
import { sanitize } from '@/lib/utils'
import { getOrCreateChat } from '@/lib/chat'
import { deleteListingAction } from '@/actions/admin'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [contacting, setContacting] = useState(false)
  const [profileComplete, setProfileComplete] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async (res) => {
      const uid = res.data.user?.id ?? null
      setUserId(uid)
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('faculty, semester, role').eq('id', uid).single()
        setProfileComplete(!!(prof?.faculty && prof?.semester))
        setUserRole(prof?.role ?? null)
      }
    })

    const fetchListingData = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(full_name, avatar_url, rating_avg, review_count, is_verified)')
        .eq('id', id)
        .single()

      if (data) {
        setListing(data as Listing)
        // Incrementar vistas de forma atómica
        supabase.rpc('increment_listing_views', { listing_id: id }).then((rpcRes) => {
          if (rpcRes.error) {
            supabase.from('listings').update({ views: (data.views ?? 0) + 1 }).eq('id', id).then(() => {})
          }
        })
      }
      setLoading(false)
    }
    fetchListingData()
  }, [id, supabase])

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

    if (!profileComplete) {
      alert('⚠️ Debes completar tu facultad y semestre en tu perfil antes de contactar a un vendedor.')
      router.push('/profile')
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
  const isModOrAdmin = userRole === 'admin' || userRole === 'moderator'
  const sellerPhone = listing?.whatsapp_number || ''

  const formatPrice = (p: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(p)

  const getWhatsAppUrl = () => {
    if (!sellerPhone || !listing) return ''
    let clean = sellerPhone.replace(/\D/g, '')
    if (clean.startsWith('09') && clean.length === 10) {
      clean = '593' + clean.slice(1)
    } else if (clean.startsWith('9') && clean.length === 9) {
      clean = '593' + clean
    }
    const text = `¡Hola! Vi tu publicación "${listing.title}" por ${formatPrice(listing.price)} en U-Market y me gustaría más información.`
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
  }

  const handleDeleteListing = async () => {
    const reason = prompt('🛡️ Motivo de eliminación (será registrado en auditoría):')
    if (!reason) return
    if (!confirm(`¿Eliminar la publicación "${listing!.title}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteListingAction(listing!.id, reason)
      alert('Publicación eliminada correctamente.')
      router.push('/')
    } catch (err: unknown) {
      const e = err as Error
      alert('Error al eliminar: ' + (e?.message || 'Error desconocido'))
    }
  }

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

          {/* Banner perfil incompleto */}
          {userId && !profileComplete && (
            <div style={{
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 12, padding: '0.875rem 1.25rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong style={{ display: 'block', color: '#fcd34d', fontSize: '0.88rem' }}>Completa tu perfil para continuar</strong>
                  <span style={{ fontSize: '0.78rem', color: '#fde68a', opacity: 0.9 }}>Falta tu facultad y semestre en tu cuenta.</span>
                </div>
              </div>
              <Link href="/profile" style={{
                background: '#f59e0b', color: 'white', padding: '0.45rem 1rem',
                borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap'
              }}>Completar ahora →</Link>
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
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={listing.profiles.avatar_url} alt="avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                      ) : (
                        listing.profiles.full_name?.[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{listing.profiles.full_name || 'Vendedor UTA'}</span>
                        {listing.profiles.is_verified && <VerifiedBadge size="sm" showText />}
                      </div>
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
                  <>
                    <button 
                      onClick={handleContact}
                      disabled={contacting || !profileComplete}
                      className="btn-primary" 
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        cursor: !profileComplete ? 'not-allowed' : 'pointer',
                        border: 'none',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        opacity: !profileComplete ? 0.65 : 1,
                        background: !profileComplete ? 'rgba(245, 158, 11, 0.2)' : undefined,
                        color: !profileComplete ? '#fcd34d' : undefined,
                        borderWidth: !profileComplete ? 1 : 0,
                        borderStyle: 'solid',
                        borderColor: !profileComplete ? 'rgba(245, 158, 11, 0.4)' : 'transparent',
                        padding: '0.625rem 1rem',
                      }}
                      title={!profileComplete ? 'Debes completar tu facultad y semestre en tu perfil primero' : ''}
                    >
                      {contacting ? 'Conectando...' : !profileComplete ? (
                        <>
                          <span style={{ marginRight: 6 }}>🔒</span>
                          Completa tu perfil para contactar
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          Enviar Mensaje
                        </>
                      )}
                    </button>

                    {sellerPhone && (
                      profileComplete ? (
                        <a
                          href={getWhatsAppUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-whatsapp"
                          style={{
                            flex: '0 0 auto',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.9rem',
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </a>
                      ) : (
                        <button
                          disabled
                          className="btn-secondary"
                          style={{
                            opacity: 0.6,
                            cursor: 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            fontSize: '0.85rem',
                            padding: '0.625rem 1rem',
                          }}
                          title="Completa tu perfil para contactar por WhatsApp"
                        >
                          🔒 WhatsApp
                        </button>
                      )
                    )}
                  </>
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

                {/* Boton de moderacion: visible para admin y moderadores */}
                {isModOrAdmin && listing.status !== 'removed' && (
                  <button
                    onClick={handleDeleteListing}
                    className="btn-danger"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0.625rem 1rem',
                      fontSize: '0.85rem',
                      width: '100%',
                      marginTop: 8,
                      justifyContent: 'center',
                      background: 'rgba(127,29,29,0.35)',
                      borderColor: 'rgba(239,68,68,0.4)',
                      color: '#fca5a5',
                    }}
                  >
                    🗑️ Eliminar publicación (Moderación)
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
