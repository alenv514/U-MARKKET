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
        fontWeight: active ? 600 : 500,
        color: active ? 'white' : 'var(--text-secondary)',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.target as HTMLElement).style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.target as HTMLElement).style.color = 'var(--text-secondary)'
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
        color: 'var(--text-primary)',
        fontWeight: 500,
      }}
    >
      {children}
    </Link>
  )
}
