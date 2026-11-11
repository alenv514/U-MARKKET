'use client'

import { createPortal } from 'react-dom'

interface PWAInstallModalProps {
  isOpen: boolean
  isIOS: boolean
  onClose: () => void
}

export default function PWAInstallModal({ isOpen, isIOS, onClose }: PWAInstallModalProps) {
  if (!isOpen || typeof window === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(10, 37, 64, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in-up"
        style={{
          maxWidth: 500,
          width: '92%',
          padding: '2.2rem 1.8rem',
          borderRadius: 24,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px rgba(10, 37, 64, 0.2)',
          position: 'relative',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        <div
          style={{
            width: 56,
            height: 56,
            background: 'linear-gradient(135deg, #00345e, #004b87)',
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.7rem',
            fontWeight: 900,
            color: 'white',
            boxShadow: '0 4px 16px rgba(0, 52, 94, 0.3)',
            marginBottom: '1rem',
          }}
        >
          U
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '0.4rem', color: '#0a192f' }}>
          Instala U-Market en tu Celular o PC
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          Disfruta de navegación en pantalla completa, acceso rápido desde tu inicio y notificaciones instantáneas.
        </p>

        {isIOS ? (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '1.2rem',
              textAlign: 'left',
              marginBottom: '1.2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: '0.8rem',
                color: '#00345e',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              <span>🍎</span> Instrucciones para iPhone / iPad (Safari):
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.84rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                <span>
                  Toca el botón <strong>Compartir</strong> <span style={{ fontSize: '1rem' }}>📤</span> en la barra
                  inferior de Safari.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                <span>
                  Desliza hacia abajo y selecciona <strong>«Agregar a pantalla de inicio»</strong> ➕.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                <span>
                  Toca <strong>«Agregar»</strong> en la esquina superior derecha. ¡Listo!
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '1.2rem',
              textAlign: 'left',
              marginBottom: '1.2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: '0.8rem',
                color: '#00345e',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              <span>📱</span> Pasos para instalar en tu navegador:
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: '0.84rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                <span>
                  Toca los <strong>tres puntos (⋮)</strong> en la esquina superior de Chrome / Edge.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                <span>
                  Selecciona <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong>.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    background: '#00345e',
                    color: 'white',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                <span>
                  Confirma tocando <strong>«Instalar»</strong>.
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            borderRadius: 99,
          }}
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body
  )
}
