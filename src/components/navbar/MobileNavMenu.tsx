'use client'

import type { User } from '@supabase/supabase-js'
import { MobileNavLink } from './NavLinks'

interface MobileNavMenuProps {
  isOpen: boolean
  isInstalled: boolean
  user: User | null
  isAdmin: boolean
  unreadCount: number
  onClose: () => void
  onInstallClick: () => void
  onOpenSuggestModal: () => void
  onOpenBusinessModal: () => void
  onLogout: () => void
}

export default function MobileNavMenu({
  isOpen,
  isInstalled,
  user,
  isAdmin,
  unreadCount,
  onClose,
  onInstallClick,
  onOpenSuggestModal,
  onOpenBusinessModal,
  onLogout,
}: MobileNavMenuProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        paddingBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderTop: '1px solid var(--border)',
      }}
    >
      {!isInstalled && (
        <button
          onClick={() => {
            onClose()
            onInstallClick()
          }}
          style={{
            textAlign: 'left',
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.25))',
            border: '1px solid rgba(139,92,246,0.4)',
            borderRadius: 10,
            color: '#e0e7ff',
            cursor: 'pointer',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '4px 0',
          }}
        >
          📲 Descargar / Instalar App
        </button>
      )}

      <MobileNavLink href="/" onClick={onClose}>
        Explorar
      </MobileNavLink>

      {user && (
        <MobileNavLink href="/dashboard" onClick={onClose}>
          Mi Panel
        </MobileNavLink>
      )}

      {isAdmin && (
        <MobileNavLink href="/admin" onClick={onClose}>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>🛡️ Panel Admin</span>
        </MobileNavLink>
      )}

      {user && (
        <MobileNavLink href="/listings/new" onClick={onClose}>
          Publicar
        </MobileNavLink>
      )}

      {user && (
        <MobileNavLink href="/inbox" onClick={onClose}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mensajes
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--accent-red, #ef4444)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: 99,
                }}
              >
                {unreadCount}
              </span>
            )}
          </span>
        </MobileNavLink>
      )}

      {user && (
        <MobileNavLink href="/profile" onClick={onClose}>
          Mi Perfil
        </MobileNavLink>
      )}

      <button
        onClick={() => {
          onClose()
          onOpenSuggestModal()
        }}
        style={{
          textAlign: 'left',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          color: '#fcd34d',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        💡 Enviar recomendación
      </button>

      <button
        onClick={() => {
          onClose()
          onOpenBusinessModal()
        }}
        style={{
          textAlign: 'left',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          color: '#a5b4fc',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        💼 ¿Negocio externo? (Contactar)
      </button>

      {user ? (
        <button
          onClick={onLogout}
          style={{
            textAlign: 'left',
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            color: 'var(--accent-red)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      ) : (
        <>
          <MobileNavLink href="/login" onClick={onClose}>
            Ingresar
          </MobileNavLink>
          <MobileNavLink href="/register" onClick={onClose}>
            Registrarse
          </MobileNavLink>
        </>
      )}
    </div>
  )
}
