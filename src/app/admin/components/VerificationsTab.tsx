'use client'

import type { Profile } from '@/types'
import Icon from '@/components/Icon'

interface VerificationsTabProps {
  verifications: Profile[]
  loading: boolean
  verificationFeatureEnabled: boolean
  isAdmin: boolean
  actionLoadingId: string | null
  onToggleFeature: () => void
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
  onZoomImage: (url: string) => void
}

export default function VerificationsTab({
  verifications,
  loading,
  verificationFeatureEnabled,
  isAdmin,
  actionLoadingId,
  onToggleFeature,
  onApprove,
  onReject,
  onZoomImage,
}: VerificationsTabProps) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Banner de Control del Feature Flag */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          border: verificationFeatureEnabled ? '1px solid rgba(0,52,94,0.25)' : '1px solid #cbd5e1',
          background: verificationFeatureEnabled ? 'rgba(0,52,94,0.06)' : '#f8fafc',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {verificationFeatureEnabled ? (
              <Icon name="checkCircle" size={18} style={{ color: '#00345e', flexShrink: 0 }} />
            ) : (
              <Icon name="pause" size={18} style={{ color: '#0a192f', flexShrink: 0 }} />
            )}
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Módulo de Verificación para Estudiantes: {verificationFeatureEnabled ? 'ACTIVADO' : 'DESACTIVADO (Oculto)'}
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            {verificationFeatureEnabled
              ? 'Los estudiantes pueden ver la opción en su perfil y subir su credencial UTA.'
              : 'La función está oculta para los estudiantes hasta que decidas habilitarla para el lanzamiento oficial.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onToggleFeature}
            className={verificationFeatureEnabled ? 'btn-danger' : 'btn-primary'}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {verificationFeatureEnabled ? (
              'Desactivar Función'
            ) : (
              <>
                <Icon name="rocket" size={14} /> Activar Función (Lanzamiento)
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
          ))}
        </div>
      ) : verifications.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', color: '#00345e' }}>
            <Icon name="graduation" size={40} />
          </div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin solicitudes de verificación pendientes</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Todas las credenciales han sido revisadas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {verifications.map((user) => (
            <div
              key={user.id}
              className="glass-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                flexWrap: 'wrap',
              }}
            >
              {/* Credential Image Thumbnail */}
              {user.credential_url ? (
                <div
                  onClick={() => onZoomImage(user.credential_url || '')}
                  style={{
                    width: 70,
                    height: 90,
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'zoom-in',
                    flexShrink: 0,
                    border: '2px solid rgba(0,82,204,0.3)',
                    background: '#f8fafc',
                    position: 'relative',
                  }}
                  title="Click para ampliar imagen del carnet"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.credential_url}
                    alt="Carnet UTA"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(10,37,64,0.75)',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      textAlign: 'center',
                      padding: '2px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                    }}
                  >
                    <Icon name="search" size={10} /> Ver
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: 70,
                    height: 90,
                    borderRadius: 10,
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00345e',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="idCard" size={26} />
                </div>
              )}

              {/* Info del Alumno */}
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {user.full_name || 'Estudiante UTA'}
                  </span>
                  <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                    Pendiente de Revisión
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#00345e', marginBottom: 2 }}>
                  {user.faculty || 'Sin facultad'} {user.semester ? `· ${user.semester}` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Enviado:{' '}
                  {user.verification_submitted_at
                    ? new Date(user.verification_submitted_at).toLocaleString('es-EC')
                    : 'Recientemente'}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                {user.credential_url && (
                  <button
                    onClick={() => onZoomImage(user.credential_url || '')}
                    className="btn-secondary"
                    style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Icon name="search" size={14} /> Ver Carnet
                  </button>
                )}
                <button
                  onClick={() => onApprove(user.id)}
                  disabled={actionLoadingId === user.id}
                  className="btn-primary"
                  style={{ padding: '7px 14px', fontSize: '0.8rem', background: '#00345e', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  {actionLoadingId === user.id ? (
                    'Aprobando...'
                  ) : (
                    <>
                      <Icon name="checkCircle" size={14} /> Aprobar Verificación
                    </>
                  )}
                </button>
                <button
                  onClick={() => onReject(user.id)}
                  disabled={actionLoadingId === user.id}
                  className="btn-danger"
                  style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Icon name="xCircle" size={14} /> Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
