'use client'

import React from 'react'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: number
  readonly?: boolean
  onChange?: (rating: number) => void
  showLabel?: boolean
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 18,
  readonly = true,
  onChange,
  showLabel = false
}: StarRatingProps) {
  
  const handleClick = (index: number) => {
    if (!readonly && onChange) {
      onChange(index + 1)
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[...Array(maxStars)].map((_, i) => {
          const fillPercentage = Math.max(0, Math.min(1, rating - i))
          return (
            <div 
              key={i} 
              onClick={() => handleClick(i)}
              style={{ 
                cursor: readonly ? 'default' : 'pointer',
                position: 'relative',
                width: size,
                height: size,
                display: 'inline-block'
              }}
            >
              {/* Estrella de fondo (vacía) */}
              <svg 
                viewBox="0 0 24 24" 
                width={size} 
                height={size}
                fill="none" 
                stroke="var(--text-muted)" 
                strokeWidth="1.5"
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              
              {/* Estrella de frente (llena, con clip-path para promedios decimales) */}
              <svg 
                viewBox="0 0 24 24" 
                width={size} 
                height={size}
                fill="#f59e0b" /* ámbar/dorado */
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0,
                  clipPath: `inset(0 ${100 - (fillPercentage * 100)}% 0 0)`
                }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          )
        })}
      </div>
      {showLabel && (
        <span style={{ fontSize: `${size * 0.8}px`, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
