'use client'

import type { User } from '@supabase/supabase-js'
import { MobileNavLink, LightbulbIcon, BriefcaseIcon, DownloadIcon, ShieldIcon } from './NavLinks'

interface MobileNavMenuProps {
  isOpen: boolean
  isInstalled: boolean
  user: User | null
  isAdmin: boolean
  isModerator: boolean
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
  isModerator,
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
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
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
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '4px 0',
          }}
        >
          <DownloadIcon size={16} />
          <span>Descargar / Instalar App</span>
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
          <span style={{ color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldIcon size={16} />
            <span>Panel Admin</span>
          </span>
        </MobileNavLink>
      )}

      {isModerator && (
        <MobileNavLink href="/admin" onClick={onClose}>
          <span style={{ color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldIcon size={16} />
            <span>Panel Moderador</span>
          </span>
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
                  background: 'var(--accent-red, #dc2626)',
                  color: '#ffffff',
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
          color: '#ffffff',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <LightbulbIcon size={16} />
        <span>Enviar recomendación</span>
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
          color: '#ffffff',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <BriefcaseIcon size={16} />
        <span>¿Negocio externo? (Contactar)</span>
      </button>

      {user ? (
        <button
          onClick={onLogout}
          style={{
            textAlign: 'left',
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            color: '#ffffff',
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
