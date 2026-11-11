'use client'

import VerifiedBadge from '@/components/VerifiedBadge'
import type { UserWithSub } from '../types'

interface UsersTabProps {
  users: UserWithSub[]
  searchQuery: string
  onSearchChange: (q: string) => void
  isAdmin: boolean
  onUnbanUser: (userId: string) => void
  onBanUser: (userId: string) => void
  onApproveSeller: (userId: string) => void
  onRevokeSeller: (userId: string) => void
  onAssignModerator: (userId: string) => void
  onRevokeModerator: (userId: string) => void
  onDeleteUser: (userId: string, userName: string) => void
}

export default function UsersTab({
  users,
  searchQuery,
  onSearchChange,
  isAdmin,
  onUnbanUser,
  onBanUser,
  onApproveSeller,
  onRevokeSeller,
  onAssignModerator,
  onRevokeModerator,
  onDeleteUser,
}: UsersTabProps) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Buscador por Correo / Nombre */}
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <span
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Buscar por correo (@uta.edu.ec) o nombre..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field"
          style={{
            paddingLeft: '2.75rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        />
      </div>

      {users.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No se encontraron usuarios que coincidan con &quot;{searchQuery}&quot;
        </div>
      ) : (
        users.map((user) => {
          const sub = user.subscriptions?.find((s) => s.is_active) || user.subscriptions?.[0]
          const subActive = sub?.is_active && (!sub.ends_at || new Date(sub.ends_at) > new Date())
          return (
            <div
              key={user.id}
              className="glass-card"
              style={{
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                borderRadius: 16,
              }}
            >
              {/* Cabecera del usuario (Avatar + Info + Badges) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'white',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {user.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      marginBottom: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{user.full_name || 'Sin nombre'}</span>
                    {user.is_verified && <VerifiedBadge size="sm" showText />}
                  </div>
                  {user.email && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                        wordBreak: 'break-all',
                      }}
                    >
                      📧 {user.email}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {user.is_active === false && (
                      <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>
                        🚫 Suspendido
                      </span>
                    )}
                    <span
                      className={`badge ${
                        user.role === 'admin'
                          ? 'badge-red'
                          : user.role === 'moderator'
                          ? 'badge-amber'
                          : user.role === 'seller'
                          ? 'badge-indigo'
                          : 'badge-amber'
                      }`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {user.role === 'moderator' ? '🛡️ moderador' : user.role}
                    </span>
                    <span
                      className={`badge ${subActive ? 'badge-green' : 'badge-amber'}`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {subActive ? `✅ ${sub?.plan ?? 'free'}` : '⏱ sin sub'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de Acciones del Usuario */}
              {isAdmin && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    alignItems: 'center',
                  }}
                >
                  {user.role !== 'admin' && (
                    <>
                      {user.is_active === false ? (
                        <button
                          onClick={() => onUnbanUser(user.id)}
                          className="btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            background: '#10b981',
                            flex: '1 1 auto',
                            minHeight: 32,
                          }}
                        >
                          🟢 Activar Cuenta
                        </button>
                      ) : (
                        <>
                          {user.role === 'moderator' ? (
                            <button
                              onClick={() => onRevokeModerator(user.id)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', flex: '1 1 auto', minHeight: 32 }}
                              title="Quitar rol de moderador"
                            >
                              ↩️ Quitar Moderador
                            </button>
                          ) : (
                            <>
                              {user.role !== 'seller' ? (
                                <button
                                  onClick={() => onApproveSeller(user.id)}
                                  className="btn-primary"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    background: '#10b981',
                                    flex: '1 1 auto',
                                    minHeight: 32,
                                  }}
                                >
                                  ✅ Vendedor (30d)
                                </button>
                              ) : (
                                <button
                                  onClick={() => onRevokeSeller(user.id)}
                                  className="btn-danger"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', flex: '1 1 auto', minHeight: 32 }}
                                >
                                  ❌ Revocar Vendedor
                                </button>
                              )}
                              <button
                                onClick={() => onAssignModerator(user.id)}
                                className="btn-secondary"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  color: '#f59e0b',
                                  borderColor: 'rgba(245,158,11,0.4)',
                                  flex: '1 1 auto',
                                  minHeight: 32,
                                }}
                                title="Designar como Moderador"
                              >
                                🛡️ Moderador
                              </button>
                              <button
                                onClick={() => onBanUser(user.id)}
                                className="btn-danger"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  background: '#ef4444',
                                  flex: '1 1 auto',
                                  minHeight: 32,
                                }}
                              >
                                🚫 Banear
                              </button>
                            </>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => onDeleteUser(user.id, user.full_name || user.email || 'Usuario')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          background: 'rgba(127,29,29,0.4)',
                          border: '1px solid rgba(239,68,68,0.35)',
                          borderRadius: 8,
                          color: '#fca5a5',
                          cursor: 'pointer',
                          fontWeight: 700,
                          minHeight: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Eliminar usuario permanentemente"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
