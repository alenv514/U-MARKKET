'use client'

interface ZoomModalProps {
  imageUrl: string | null
  onClose: () => void
}

export default function ZoomModal({ imageUrl, onClose }: ZoomModalProps) {
  if (!imageUrl) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        cursor: 'zoom-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          background: '#0d1117',
          borderRadius: 16,
          padding: '1rem',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Carnet ampliado"
          style={{
            maxWidth: '85vw',
            maxHeight: '75vh',
            objectFit: 'contain',
            borderRadius: 8,
          }}
        />
        <button
          onClick={onClose}
          className="btn-secondary"
          style={{ marginTop: '0.75rem', padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
        >
          Cerrar vista previa ✕
        </button>
      </div>
    </div>
  )
}
