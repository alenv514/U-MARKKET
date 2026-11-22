import Link from 'next/link'
import type { ReactNode } from 'react'
import Icon from '@/components/Icon'

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
        color: '#ffffff',
        background: active ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#ffffff'
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#ffffff'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </Link>
  )
}

export function LightbulbIcon({ size = 16 }: { size?: number }) {
  return <Icon name="lightbulb" size={size} />
}

export function QuestionIcon({ size = 15 }: { size?: number }) {
  return <Icon name="question" size={size} strokeWidth={2.1} />
}

export function DownloadIcon({ size = 14 }: { size?: number }) {
  return <Icon name="download" size={size} strokeWidth={2.1} />
}

export function ShieldIcon({ size = 15 }: { size?: number }) {
  return <Icon name="shield" size={size} />
}

export function BriefcaseIcon({ size = 16 }: { size?: number }) {
  return <Icon name="briefcase" size={size} />
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
