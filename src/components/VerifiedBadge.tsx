'use client'

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export default function VerifiedBadge({
  size = 'md',
  showText = false,
  className = '',
}: VerifiedBadgeProps) {
  const sizeMap = {
    sm: { icon: 14, font: '0.68rem', padding: '2px 6px' },
    md: { icon: 16, font: '0.75rem', padding: '3px 8px' },
    lg: { icon: 20, font: '0.85rem', padding: '4px 10px' },
  }

  const { icon, font, padding } = sizeMap[size]

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold transition-all ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: showText ? padding : '2px',
        fontSize: font,
        borderRadius: 20,
        background: showText ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.2))' : 'transparent',
        border: showText ? '1px solid rgba(99, 102, 241, 0.35)' : 'none',
        color: '#60a5fa',
        verticalAlign: 'middle',
        cursor: 'help',
      }}
      title="🎓 Estudiante Oficial Verificado UTA (Credencial institucional comprobada)"
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))' }}
      >
        <path
          d="M12 2L15.09 5.09L19.5 5.5L20 9.91L23.09 13L20 16.09L19.5 20.5L15.09 20.91L12 24L8.91 20.91L4.5 20.5L4 16.09L0.91 13L4 9.91L4.5 5.5L8.91 5.09L12 2Z"
          fill="url(#verified-grad)"
        />
        <path
          d="M9.5 12.5L11.5 14.5L15.5 10"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="verified-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b82f6" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span style={{ fontWeight: 700, letterSpacing: '0.2px', color: '#93c5fd' }}>
          Verificado UTA
        </span>
      )}
    </span>
  )
}
