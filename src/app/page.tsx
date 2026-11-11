'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Navbar from '@/components/Navbar'
import ListingCard from '@/components/ListingCard'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, CAMPUSES, getCampusFromFaculty } from '@/types'
import type { Listing, Campus } from '@/types'
import { sanitize } from '@/lib/utils'

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedCampus, setSelectedCampus] = useState<Campus>('Todos')
  const [userId, setUserId] = useState<string | null>(null)
  const [userCampus, setUserCampus] = useState<'Campus Huachi' | 'Campus Ingahurco' | 'Campus Querochaca' | null>(null)
  
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 12
  
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('faculty').eq('id', uid).single()
        if (prof?.faculty) {
          setUserCampus(getCampusFromFaculty(prof.faculty))
        }
      }
    })
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
      .select('*, profiles(full_name, avatar_url, faculty, is_verified)')
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

  // Filtrado y priorización inteligente por Campus
  const displayedListings = useMemo(() => {
    let list = listings

    if (selectedCampus !== 'Todos') {
      list = list.filter(l => getCampusFromFaculty(l.profiles?.faculty) === selectedCampus)
    } else if (userCampus) {
      // Priorizar primero los productos del campus natal del estudiante
      list = [...list].sort((a, b) => {
        const campusA = getCampusFromFaculty(a.profiles?.faculty)
        const campusB = getCampusFromFaculty(b.profiles?.faculty)
        if (campusA === userCampus && campusB !== userCampus) return -1
        if (campusA !== userCampus && campusB === userCampus) return 1
        return 0
      })
    }

    return list
  }, [listings, selectedCampus, userCampus])

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', background: 'transparent' }}>

        {/* ── Hero ── */}
        <section style={{
          position: 'relative',
          paddingTop: '4rem', paddingBottom: '3.5rem',
          background: 'transparent',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
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
                  background: '#ffffff',
                  boxShadow: '0 4px 20px rgba(10, 37, 64, 0.08)',
                }}
              />
            </div>
          </div>
        </section>

        {/* ── Filtro por Campus (Sin emojis) ── */}
        <section className="page-container" style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginRight: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Campus:
            </span>
            {CAMPUSES.map(campus => {
              const isSelected = selectedCampus === campus
              const isUserNative = userCampus === campus
              return (
                <button
                  key={campus}
                  onClick={() => setSelectedCampus(campus)}
                  style={{
                    padding: '5px 13px',
                    borderRadius: 99,
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    border: isSelected
                      ? '1px solid #0052cc'
                      : '1px solid #e2e8f0',
                    background: isSelected
                      ? 'linear-gradient(135deg, #0a2540, #0052cc)'
                      : '#ffffff',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,82,204,0.25)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{campus === 'Todos' ? 'Todos los campus' : campus}</span>
                  {isUserNative && (
                    <span style={{
                      fontSize: '0.62rem',
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,82,204,0.1)',
                      color: isSelected ? '#ffffff' : '#0052cc',
                      padding: '1px 6px',
                      borderRadius: 99,
                      fontWeight: 600,
                      border: isSelected ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(0,82,204,0.2)',
                    }}>
                      Tu campus
                    </span>
                  )}
                </button>
              )
            })}
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
          ) : displayedListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No se encontraron publicaciones</h3>
              <p style={{ fontSize: '0.9rem' }}>
                {search
                  ? `No hay resultados para "${search}"`
                  : selectedCampus !== 'Todos'
                  ? `No hay publicaciones activas en ${selectedCampus}`
                  : 'Sé el primero en publicar en esta categoría'}
              </p>
            </div>
          ) : (
            <>
              <div className="listings-grid">
                {displayedListings.map((listing, i) => (
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

        
        {/* Simple Footer */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 0', textAlign: 'center', background: '#ffffff' }}>
          <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <a href="/terminos" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.75rem', transition: 'color 0.2s' }}>Términos y Condiciones</a>
            <a href="/privacidad" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.75rem', transition: 'color 0.2s' }}>Políticas de Privacidad</a>
            <a 
              href="https://wa.me/593999752932?text=Hola!%20Tengo%20una%20consulta%20sobre%20U-Market." 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: '#059669', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              💬 Contactar Administración / Negocios
            </a>
          </div>
        </footer>
      </main>
    </>
  )
}
