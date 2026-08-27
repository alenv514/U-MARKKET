'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Navbar from '@/components/Navbar'
import ListingCard from '@/components/ListingCard'
import LightRays from '@/components/LightRays'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/types'
import type { Listing } from '@/types'
import { sanitize } from '@/lib/utils'

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [userId, setUserId] = useState<string | null>(null)
  
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 12
  
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase])

  const fetchListings = useCallback(async (pageNum: number, isNewSearch = false) => {
    if (isNewSearch) {
      setLoading(true)
      setPage(0)
    } else {
      setLoadingMore(true)
    }

    let query = supabase
      .from('listings')
      .select('*, profiles(full_name, avatar_url)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(pageNum * ITEMS_PER_PAGE, (pageNum + 1) * ITEMS_PER_PAGE - 1)

    if (selectedCategory !== 'Todos') {
      query = query.eq('category', selectedCategory)
    }
    if (search.trim()) {
      // Limpiar caracteres especiales que puedan alterar la sintaxis de PostgREST
      const safeTerm = search.trim().replace(/[(),%*"\\]/g, '').slice(0, 80)
      if (safeTerm) {
        query = query.or(`title.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`)
      }
    }

    const { data } = await query
    const results = (data as Listing[]) ?? []
    
    setHasMore(results.length === ITEMS_PER_PAGE)

    if (isNewSearch) {
      setListings(results)
    } else {
      setListings(prev => [...prev, ...results])
    }
    
    setLoading(false)
    setLoadingMore(false)
  }, [selectedCategory, search, supabase])

  // Carga inicial y cambio de categoría inmediato
  useEffect(() => {
    if (!search.trim()) {
      fetchListings(0, true)
      return
    }
    // Debounce de 300ms solo mientras el usuario está escribiendo en el buscador
    const timer = setTimeout(() => {
      fetchListings(0, true)
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedCategory, search, fetchListings])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchListings(nextPage, false)
  }

  const handleReport = async (listingId: string) => {
    if (!userId) { alert('Debes iniciar sesión para reportar'); return }
    const reason = prompt('¿Por qué reportas esta publicación?')
    if (!reason) return
    const safeReason = sanitize(reason).slice(0, 500)
    const { error } = await supabase
      .from('reports')
      .insert({ listing_id: listingId, reporter_id: userId, reason: safeReason })
    if (error?.code === '23505') {
      alert('Ya reportaste esta publicación')
    } else if (!error) {
      alert('Reporte enviado. Gracias por ayudarnos a mantener U-Market seguro.')
    }
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh' }}>

        {/* ── Hero ── */}
        <section style={{
          position: 'relative',
          paddingTop: '4rem', paddingBottom: '3rem',
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15), transparent)',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {/* Light Rays Background */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.9 }}>
            <LightRays
              raysOrigin="top-center"
              raysColor="#a5b4fc"
              raysSpeed={1.5}
              lightSpread={0.8}
              rayLength={1.2}
              followMouse={true}
              mouseInfluence={0.1}
              noiseAmount={0.05}
              distortion={0.05}
            />
          </div>

          <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="animate-fade-in-up">
              <h1 style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 900, lineHeight: 1.1,
                marginBottom: '1rem',
              }}>
                El marketplace de{' '}
                <span className="gradient-text">tu universidad</span>
              </h1>
              <p style={{
                fontSize: '1.1rem', color: 'var(--text-secondary)',
                maxWidth: 520, margin: '0 auto 2rem',
                lineHeight: 1.6,
              }}>
                Compra y vende cualquier producto o servicio con compañeros de la UTA.
                Fácil, rápido y seguro.
              </p>
            </div>

            {/* Search bar */}
            <div className="animate-fade-in-up delay-200" style={{
              maxWidth: 560, margin: '0 auto',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <input
                id="search-input"
                type="text"
                placeholder="Buscar productos, servicios..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '2.75rem', paddingRight: '1rem',
                  fontSize: '1rem', borderRadius: 14,
                  background: 'rgba(255,255,255,0.05)',
                }}
              />
            </div>
          </div>
        </section>


        {/* ── Categories ── */}
        <section className="page-container" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* ── Listings grid ── */}
        <section className="page-container" style={{ paddingBottom: '4rem' }}>
          {loading ? (
            <div className="listings-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card" style={{ overflow: 'hidden' }}>
                  <div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 0 }} />
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="skeleton" style={{ height: 20, width: '80%' }} />
                    <div className="skeleton" style={{ height: 14, width: '60%' }} />
                    <div className="skeleton" style={{ height: 24, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No se encontraron publicaciones</h3>
              <p style={{ fontSize: '0.9rem' }}>
                {search ? `No hay resultados para "${search}"` : 'Sé el primero en publicar en esta categoría'}
              </p>
            </div>
          ) : (
            <>
              <div className="listings-grid">
                {listings.map((listing, i) => (
                  <div key={listing.id} style={{ animationDelay: `${(i % ITEMS_PER_PAGE) * 0.05}s` }}>
                    <ListingCard listing={listing} currentUserId={userId} onReport={userId ? handleReport : undefined} />
                  </div>
                ))}
              </div>
              
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                  <button 
                    onClick={handleLoadMore} 
                    disabled={loadingMore}
                    className="btn-secondary" 
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: 100 }}
                  >
                    {loadingMore ? 'Cargando...' : 'Cargar más resultados'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        
        {/* ── Section para Negocios Externos ── */}
        <section className="page-container" style={{ paddingBottom: '3rem' }}>
          <div className="glass-card animate-fade-in-up" style={{
            padding: '2.25rem 2rem',
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}>
            <div style={{ maxWidth: 580 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.15)', padding: '4px 12px', borderRadius: 99, fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.75rem' }}>
                💼 ¿Tienes un negocio local o emprendimiento externo?
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Anúnciate y publica en U-Market
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                ¿No eres estudiante pero deseas vender o promocionar tu marca en el marketplace de la UTA? Escríbenos por WhatsApp para solicitar autorización y publicar en la plataforma.
              </p>
            </div>
            
            <a 
              href="https://wa.me/593999752932?text=Hola!%20Tengo%20un%20negocio%20externo%20y%20me%20gustar%C3%ADa%20publicar/anunciarme%20en%20U-Market." 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#25D366',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                padding: '0.85rem 1.75rem',
                borderRadius: 99,
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(37, 211, 102, 0.3)',
                transition: 'transform 0.2s ease',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>💬</span>
              Contactar por WhatsApp
            </a>
          </div>
        </section>
        
        {/* Simple Footer */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 0', textAlign: 'center' }}>
          <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <a href="/terminos" style={{ color: 'rgba(255, 255, 255, 0.25)', textDecoration: 'none', fontSize: '0.75rem', transition: 'color 0.2s' }}>Términos y Condiciones</a>
            <a href="/privacidad" style={{ color: 'rgba(255, 255, 255, 0.25)', textDecoration: 'none', fontSize: '0.75rem', transition: 'color 0.2s' }}>Políticas de Privacidad</a>
            <a 
              href="https://wa.me/593999752932?text=Hola!%20Tengo%20una%20consulta%20sobre%20U-Market." 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: '#25D366', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              💬 Contactar Administración / Negocios
            </a>
          </div>
        </footer>
      </main>
    </>
  )
}
