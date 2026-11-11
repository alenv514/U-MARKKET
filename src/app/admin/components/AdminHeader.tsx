'use client'

interface AdminHeaderProps {
  onDownloadExcel: () => void
  onToggleFreeMode: () => void
  onToggleRequireApproval: () => void
  freePublishingMode: boolean
  requireApprovalMode: boolean
}

export default function AdminHeader({
  onDownloadExcel,
  onToggleFreeMode,
  onToggleRequireApproval,
  freePublishingMode,
  requireApprovalMode
}: AdminHeaderProps) {
  return (
    <>
      <div
        className="animate-fade-in-up"
        style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span className="badge badge-red">🛡️ Admin</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Panel de Administración</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Gestiona reportes, usuarios y suscripciones de U-Market
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={onDownloadExcel}
            style={{
              fontWeight: 700,
              padding: '0.625rem 1.25rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            📥 Descargar Reporte Excel
          </button>
          <button
            onClick={onToggleFreeMode}
            className={freePublishingMode ? 'btn-danger' : 'btn-primary'}
            style={{ fontWeight: 700, padding: '0.625rem 1.25rem' }}
          >
            {freePublishingMode ? '🔴 Desactivar Publicación Libre' : '🟢 Activar Publicación Libre'}
          </button>
          <button
            onClick={onToggleRequireApproval}
            className={requireApprovalMode ? 'btn-danger' : 'btn-primary'}
            style={{
              fontWeight: 700,
              padding: '0.625rem 1.25rem',
              background: requireApprovalMode ? undefined : 'linear-gradient(135deg, var(--accent-amber), #d97706)',
            }}
          >
            {requireApprovalMode ? '🔴 Desactivar Aprobación' : '🛡️ Activar Aprobación'}
          </button>
        </div>
      </div>

      {freePublishingMode && (
        <div
          className="animate-fade-in-up"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#ef4444',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <h3 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>Modo &quot;Publicación Libre&quot; Activado</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Todos los usuarios pueden publicar sin suscripción.</p>
          </div>
        </div>
      )}
    </>
  )
}
