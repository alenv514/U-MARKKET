'use client'

import type { ReportWithListing } from '../types'

interface ReportsTabProps {
  reports: ReportWithListing[]
  loading: boolean
  onDismiss: (reportId: string) => void
  onWarnSeller: (reportId: string, sellerId: string) => void
  onRemoveListing: (listingId: string | undefined, reportId: string) => void
}

export default function ReportsTab({
  reports,
  loading,
  onDismiss,
  onWarnSeller,
  onRemoveListing,
}: ReportsTabProps) {
  return (
    <div className="animate-fade-in">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin reportes pendientes</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¡La plataforma está limpia!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className="glass-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                  {report.listings?.title || 'Publicación eliminada'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Razón: <strong style={{ color: 'var(--text-primary)' }}>{report.reason}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(report.created_at).toLocaleDateString('es-EC')}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: '0.65rem',
                }}
              >
                <button
                  onClick={() => onDismiss(report.id)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', flex: '1 1 auto' }}
                >
                  Ignorar
                </button>
                {report.listings?.seller_id && (
                  <button
                    onClick={() => onWarnSeller(report.id, report.listings.seller_id)}
                    className="btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      background: '#f59e0b',
                      flex: '1 1 auto',
                    }}
                  >
                    Advertir Vendedor
                  </button>
                )}
                <button
                  onClick={() => onRemoveListing(report.listings?.id, report.id)}
                  className="btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', flex: '1 1 auto' }}
                >
                  Eliminar listing
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
