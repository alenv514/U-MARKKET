'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Profile, Subscription } from '@/types'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [freePublishingMode, setFreePublishingMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 10
  
  const supabase = createClient()

  const fetchInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, subRes, settingsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'free_publishing_mode').single()
    ])

    setProfile(profileRes.data)
    setSubscription(subRes.data)
    setFreePublishingMode(settingsRes.data?.value === true || settingsRes.data?.value === 'true')
    
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

  useEffect(() => { fetchInitialData() }, [fetchInitialData])

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
    await supabase.from('listings').delete().eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const handleToggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'active' ? 'paused' : 'active'
    await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id)
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l))
  }

  const isSubActive = subscription && (
    !subscription.ends_at || new Date(subscription.ends_at) > new Date()
  )

  const daysLeft = subscription?.ends_at
    ? Math.max(0, Math.floor((new Date(subscription.ends_at).getTime() - Date.now()) / 86400000))
    : null

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

          {/* Stats */}
          <div className="animate-fade-in-up delay-100" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard icon="📦" label="Total publicaciones" value={listings.length} color="#6366f1" />
            <StatCard icon="✅" label="Activas" value={activeListings} color="#10b981" />
            <StatCard icon="⏸️" label="Pausadas" value={listings.filter(l => l.status === 'paused').length} color="#f59e0b" />
            <StatCard icon="👁️" label="Vistas totales" value={listings.reduce((s, l) => s + l.views, 0)} color="#8b5cf6" />
          </div>

          {/* Subscription status */}
          <div className="glass-card animate-fade-in-up delay-200" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: isSubActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
              }}>
                {isSubActive ? '🟢' : '🔴'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {isSubActive ? 'Suscripción activa' : 'Suscripción inactiva'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {!subscription 
                    ? 'No tienes un plan activo'
                    : subscription.plan === 'free'
                      ? daysLeft !== null
                        ? daysLeft > 0 ? `Plan gratuito — ${daysLeft} días restantes` : 'Período gratuito expirado'
                        : 'Plan gratuito'
                      : 'Plan pagado activo'}
                </div>
              </div>
            </div>
            {subscription?.plan === 'free' && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
              <span className="badge badge-amber">⚠️ Renueva pronto</span>
            )}
            {!isSubActive && !freePublishingMode && (
              <span className="badge badge-red">Sin suscripción activa — no puedes publicar</span>
            )}
            {!isSubActive && freePublishingMode && (
              <span className="badge badge-green">Modo de publicación libre activo 🟢</span>
            )}
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
                      width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                      background: listing.image_url
                        ? `url(${listing.image_url}) center/cover`
                        : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                    }}>
                      {!listing.image_url && '📦'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.title}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-amber)', fontWeight: 800, fontSize: '0.9rem' }}>
                          ${listing.price}
                        </span>
                        <span className={`badge ${listing.status === 'active' ? 'badge-green' : 'badge-amber'}`}>
                          {listing.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {listing.views} vistas
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleToggleStatus(listing)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      >
                        {listing.status === 'active' ? 'Pausar' : 'Activar'}
                      </button>
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
