'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Profile } from '@/types'
import { computeReputation } from '@/lib/reputation'
import { bumpListingAction, toggleUrgentAction } from '@/actions/reputation'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [bumpingId, setBumpingId] = useState<string | null>(null)
  const [urgentId, setUrgentId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 10
  
  const supabase = useMemo(() => createClient(), [])

  const fetchInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, is_active, faculty, semester, is_verified, rating_avg, review_count, created_at, updated_at')
      .eq('id', user.id)
      .single()

    setProfile(profileData)
    
    // Fetch initial listings
    const { data: listingsData } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, ITEMS_PER_PAGE - 1)
      
    const results = listingsData ?? []
    setListings(results)
    setHasMore(results.length === ITEMS_PER_PAGE)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let mounted = true
    if (mounted) {
      fetchInitialData()
    }
    return () => { mounted = false }
  }, [fetchInitialData])

  const loadMoreListings = async () => {
    setLoadingMore(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const nextPage = page + 1
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .range(nextPage * ITEMS_PER_PAGE, (nextPage + 1) * ITEMS_PER_PAGE - 1)

    const results = data ?? []
    setListings(prev => [...prev, ...results])
    setHasMore(results.length === ITEMS_PER_PAGE)
    setPage(nextPage)
    setLoadingMore(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta publicación?')) return
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar la publicación: ' + error.message)
      return
    }
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const handleToggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active'
    const { error } = await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id)
    if (error) {
      alert('Error al cambiar el estado: ' + error.message)
      return
    }
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l))
  }

  const handleBump = async (listingId: string) => {
    setBumpingId(listingId)
    const res = await bumpListingAction(listingId)
    setBumpingId(null)
    if (!res.success) {
      alert(res.error || 'No se pudo subir la publicación.')
    } else {
      alert('¡Tu publicación ha sido subida al inicio del catálogo con éxito!')
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, bumped_at: res.bumped_at } : l))
    }
  }

  const handleToggleUrgent = async (listingId: string) => {
    setUrgentId(listingId)
    const res = await toggleUrgentAction(listingId)
    setUrgentId(null)
    if (!res.success) {
      alert(res.error || 'No se pudo actualizar la oferta.')
    } else {
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, is_urgent: res.is_urgent } : l))
    }
  }

  const activeListings = listings.filter(l => l.status === 'active').length

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh' }}>
          <div className="page-container" style={{ paddingTop: '3rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />
              ))}
            </div>
          </div>
        </main>
      </>
    )
  }
  if (profile && profile.is_active === false) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="page-container glass-card animate-fade-in-up" style={{ maxWidth: 500, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-red)', marginBottom: '1rem' }}>
              Acceso Restringido
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tu cuenta en U-Market ha sido suspendida por infringir las políticas de la comunidad. No puedes acceder a tu panel de control ni publicar productos.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Si crees que esto es un error, por favor ponte en contacto con el soporte administrativo de la plataforma.
            </p>
          </div>
        </main>
      </>
    )
  }
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem' }}>

          {/* Header */}
          <div className="animate-fade-in-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 4 }}>
                Hola, {profile?.full_name?.split(' ')[0] ?? 'Vendedor'} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gestiona tus publicaciones desde aquí</p>
            </div>
            <Link href="/listings/new">
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nueva publicación
              </button>
            </Link>
          </div>

          {/* Nivel de Confianza y Recompensas UTA */}
          {profile && (() => {
            const rep = computeReputation(profile, {
              activeListings,
              bookListings: listings.filter(l => l.category === 'Libros y Apuntes').length,
            })
            return (
              <div className="glass-card animate-fade-in-up" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', borderLeft: `4px solid ${rep.badgeColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tu reputación estudiantil
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: rep.badgeColor,
                        background: `${rep.badgeColor}15`,
                        padding: '2px 8px',
                        borderRadius: 99,
                        border: `1px solid ${rep.badgeColor}30`,
                      }}>
                        {rep.badgeLabel}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, margin: 0 }}>
                      Nivel {rep.level}: {rep.levelName}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Link href="/profile" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00345e', textDecoration: 'none' }}>
                      Ver Vitrina de Logros →
                    </Link>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Progreso de confianza: <strong>{rep.progressPercent}%</strong></span>
                    {rep.nextLevelName && <span>Siguiente: <strong>{rep.nextLevelName}</strong></span>}
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${rep.progressPercent}%`, height: '100%', background: `linear-gradient(90deg, #00345e, ${rep.badgeColor})`, borderRadius: 999, transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: '0.85rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {profile.is_verified ? '✅' : '🔒'} Bump diario ({profile.is_verified ? 'Desbloqueado' : 'Requiere verificar carnet'})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    ⭐ {profile.review_count ?? 0} {profile.review_count === 1 ? 'opinión' : 'opiniones'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    📦 Publicaciones gratuitas ilimitadas
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Stats */}
          <div className="animate-fade-in-up delay-100" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard icon="📦" label="Total publicaciones" value={listings.length} color="#00345e" />
            <StatCard icon="✅" label="Activas" value={activeListings} color="#10b981" />
            <StatCard icon="⏸️" label="Pausadas" value={listings.filter(l => l.status === 'paused').length} color="#f59e0b" />
            <StatCard icon="👁️" label="Vistas totales" value={listings.reduce((s, l) => s + l.views, 0)} color="#004b87" />
          </div>

          {/* Listings */}
          <div className="animate-fade-in-up delay-300">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
              Mis publicaciones
            </h2>

            {listings.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Aún no tienes publicaciones</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Crea tu primera publicación y empieza a vender
                </p>
                <Link href="/listings/new">
                  <button className="btn-primary">Crear primera publicación</button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {listings.map(listing => (
                  <div key={listing.id} className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Image thumb */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                      background: 'linear-gradient(135deg, rgba(0,52,94,0.1), rgba(0,75,135,0.1))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                    }}>
                      {listing.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        '📦'
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.title}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-amber)', fontWeight: 800, fontSize: '0.9rem' }}>
                          ${listing.price}
                        </span>
                        <span className={`badge ${listing.status === 'active' ? 'badge-green' : listing.status === 'pending_approval' ? 'badge-indigo' : 'badge-amber'}`}>
                          {listing.status === 'active' ? 'Activa' : listing.status === 'pending_approval' ? 'En revisión' : 'Pausada'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {listing.views} vistas
                        </span>
                      </div>
                    </div>

                    <div className="actions-wrap">
                      {listing.status === 'active' && (() => {
                        const lastBump = new Date(listing.bumped_at || listing.created_at).getTime()
                        const diffHours = (Date.now() - lastBump) / (1000 * 60 * 60)
                        const canBumpNow = diffHours >= 24
                        const hoursLeft = Math.max(1, Math.ceil(24 - diffHours))

                        return (
                          <>
                            <button
                              onClick={() => handleBump(listing.id)}
                              disabled={!canBumpNow || bumpingId === listing.id}
                              className="btn-primary"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                opacity: canBumpNow ? 1 : 0.6,
                                cursor: canBumpNow ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title={canBumpNow ? 'Subir al inicio del catálogo (gratis cada 24h)' : `Próximo bump disponible en ${hoursLeft} horas`}
                            >
                              {bumpingId === listing.id ? 'Subiendo...' : canBumpNow ? '🚀 Subir al inicio' : `Reactivado (${hoursLeft}h)`}
                            </button>

                            <button
                              onClick={() => handleToggleUrgent(listing.id)}
                              disabled={urgentId === listing.id}
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                borderRadius: 8,
                                cursor: 'pointer',
                                border: listing.is_urgent ? '1px solid #d97706' : '1px solid var(--border)',
                                background: listing.is_urgent ? '#fffbeb' : '#ffffff',
                                color: listing.is_urgent ? '#b45309' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                              }}
                              title="Destacar como oferta rápida del día"
                            >
                              {listing.is_urgent ? '⚡ Oferta activa' : '⚡ Oferta hoy'}
                            </button>
                          </>
                        )
                      })()}

                      {listing.status !== 'pending_approval' && (
                        <button
                          onClick={() => handleToggleStatus(listing)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          {listing.status === 'active' ? 'Pausar' : 'Activar'}
                        </button>
                      )}
                      <Link href={`/listings/${listing.id}/edit`}>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                          Editar
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(listing.id)}
                        className="btn-danger"
                        style={{ padding: '6px 12px' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
                
                {hasMore && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button 
                      onClick={loadMoreListings} 
                      disabled={loadingMore}
                      className="btn-secondary" 
                      style={{ padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: 100 }}
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más publicaciones'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
        }}>{icon}</div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 900, color }}>{value}</div>
    </div>
  )
}
