'use client'

import type { PendingListing } from '../types'

interface ApprovalsTabProps {
  pendingListings: PendingListing[]
  loading: boolean
  onApprove: (listingId: string) => void
  onReject: (listingId: string) => void
}

export default function ApprovalsTab({
  pendingListings,
  loading,
  onApprove,
  onReject,
}: ApprovalsTabProps) {
  return (
    <div className="animate-fade-in">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      ) : pendingListings.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin publicaciones pendientes</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¡Todo al día!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pendingListings.map((listing) => (
            <div
              key={listing.id}
              className="glass-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              {/* Image thumb */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: listing.image_url
                    ? `url(${listing.image_url}) center/cover`
                    : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}
              >
                {!listing.image_url && '📦'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{listing.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 800, fontSize: '0.9rem' }}>
                    ${listing.price}
                  </span>
                  <span className="badge badge-indigo">{listing.category}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Por: <strong>{listing.profiles?.full_name || 'Vendedor UTA'}</strong>
                  </span>
                </div>
                {listing.description && (
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: 0,
                    }}
                  >
                    {listing.description}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={`/listings/${listing.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    👁️ Ver Detalles
                  </button>
                </a>
                <button
                  onClick={() => onApprove(listing.id)}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#10b981' }}
                >
                  ✅ Aprobar
                </button>
                <button
                  onClick={() => onReject(listing.id)}
                  className="btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  ❌ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
