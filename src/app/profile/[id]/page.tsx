import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StarRating from '@/components/StarRating'
import ReviewForm from '@/components/ReviewForm'
import VerifiedBadge from '@/components/VerifiedBadge'
import type { Listing } from '@/types'

interface ReviewWithReviewer {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer?: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

export default async function ProfilePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: authData } = await supabase.auth.getUser()
  const currentUserId = authData?.user?.id

  // Obtener perfil (solo columnas públicas, protegiendo teléfono y correo)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, created_at, rating_avg, review_count, is_verified, faculty, semester')
    .eq('id', params.id)
    .single()

  if (!profile) return notFound()

  // Obtener productos activos
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', params.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Obtener reseñas
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name, avatar_url)')
    .eq('reviewee_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      
      {/* Botón Volver */}
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--text-secondary)', textDecoration: 'none',
        fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: 500
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Volver al inicio
      </Link>

      {/* Cabecera del Perfil */}
      <div className="glass-card animate-fade-in-up" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', backgroundColor: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800,
          color: 'var(--accent-primary)', marginBottom: '1rem', border: '2px solid rgba(99,102,241,0.3)',
          overflow: 'hidden'
        }}>
          {profile.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile.full_name?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{profile.full_name}</h1>
          {profile.is_verified && <VerifiedBadge size="md" showText />}
        </div>
        {profile.faculty && (
          <div style={{ fontSize: '0.85rem', color: '#a5b4fc', marginBottom: '0.5rem', fontWeight: 500 }}>
            {profile.faculty} {profile.semester ? `· ${profile.semester}` : ''}
          </div>
        )}
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Miembro desde {new Date(profile.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </p>

        {/* Reputación en Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1.5rem', borderRadius: 20 }}>
          <StarRating rating={Number(profile.rating_avg || 0)} size={22} showLabel />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ({profile.review_count} {profile.review_count === 1 ? 'reseña' : 'reseñas'})
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Productos del vendedor */}
        <div className="animate-fade-in-up delay-100">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Publicaciones activas</h2>
          {listings && listings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {listings.map((listing: Listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} style={{ textDecoration: 'none' }}>
                  <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 8, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                      {listing.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', opacity: 0.5 }}>📦</div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{listing.title}</h3>
                      <p style={{ color: '#10b981', fontWeight: 700 }}>${listing.price.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Este vendedor no tiene publicaciones activas.</p>
          )}
        </div>

        {/* Sección de Reseñas */}
        <div className="animate-fade-in-up delay-200">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Reseñas</h2>
          
          <div style={{ marginBottom: '2rem' }}>
            <ReviewForm revieweeId={profile.id} currentUserId={currentUserId} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews && reviews.length > 0 ? (
              (reviews as unknown as ReviewWithReviewer[]).map((rev) => (
                <div key={rev.id} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                        {rev.reviewer?.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={rev.reviewer.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          rev.reviewer?.full_name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rev.reviewer?.full_name || 'Usuario'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(rev.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <StarRating rating={rev.rating} size={14} />
                  </div>
                  {rev.comment && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>&ldquo;{rev.comment}&rdquo;</p>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                Aún no hay reseñas. ¡Sé el primero en calificar!
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
