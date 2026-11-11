import Link from 'next/link'
import type { ReactNode } from 'react'

export function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: '0.875rem',
        fontWeight: active ? 700 : 500,
        color: active ? '#ffffff' : '#cbd5e1',
        background: active ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          ;(e.target as HTMLElement).style.color = '#ffffff'
          ;(e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.08)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          ;(e.target as HTMLElement).style.color = '#cbd5e1'
          ;(e.target as HTMLElement).style.background = 'transparent'
        }
      }}
    >
      {children}
    </Link>
  )
}

export function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        textDecoration: 'none',
        display: 'block',
        padding: '10px 12px',
        borderRadius: 8,
        color: '#ffffff',
        fontWeight: 500,
      }}
    >
      {children}
    </Link>
  )
}
