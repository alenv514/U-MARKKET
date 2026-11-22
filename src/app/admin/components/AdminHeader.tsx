'use client'

import Icon from '@/components/Icon'

interface AdminHeaderProps {
  isAdmin: boolean
  onDownloadExcel: () => void
  onToggleFreeMode: () => void
  onToggleRequireApproval: () => void
  freePublishingMode: boolean
  requireApprovalMode: boolean
}

export default function AdminHeader({
  isAdmin,
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
            <span
              className={isAdmin ? 'badge badge-red' : 'badge badge-amber'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Icon name="shield" size={13} />
              {isAdmin ? 'Admin' : 'Moderador'}
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>
              {isAdmin ? 'Panel de Administración' : 'Panel de Moderación'}
            </h1>
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
              background: 'linear-gradient(135deg, #00345e, #004b87)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="download" size={15} /> Descargar Reporte Excel
          </button>
          {isAdmin && (
            <>
              <button
                onClick={onToggleFreeMode}
                className={freePublishingMode ? 'btn-danger' : 'btn-primary'}
                style={{ fontWeight: 700, padding: '0.625rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {freePublishingMode ? (
                  <>
                    <Icon name="xCircle" size={15} /> Desactivar Publicación Libre
                  </>
                ) : (
                  <>
                    <Icon name="checkCircle" size={15} /> Activar Publicación Libre
                  </>
                )}
              </button>
              <button
                onClick={onToggleRequireApproval}
                className={requireApprovalMode ? 'btn-danger' : 'btn-primary'}
                style={{
                  fontWeight: 700,
                  padding: '0.625rem 1.25rem',
                  background: requireApprovalMode ? undefined : '#004b87',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {requireApprovalMode ? (
                  <>
                    <Icon name="xCircle" size={15} /> Desactivar Aprobación
                  </>
                ) : (
                  <>
                    <Icon name="shield" size={15} /> Activar Aprobación
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {freePublishingMode && (
        <div
          className="animate-fade-in-up"
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#b91c1c',
          }}
        >
          <Icon name="alert" size={24} style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>Modo &quot;Publicación Libre&quot; Activado</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Todos los usuarios pueden publicar sin suscripción.</p>
          </div>
        </div>
      )}
    </>
  )
}
