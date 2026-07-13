'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface ImageCarouselProps {
  images: string[]
  title: string
  autoPlay?: boolean
  interval?: number
  /** true = modo compacto para cards, false = modo grande para detalle */
  compact?: boolean
}

export default function ImageCarousel({
  images,
  title,
  autoPlay = true,
  interval = 3000,
  compact = true,
}: ImageCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

  const validImages = images.filter(Boolean)
  const total = validImages.length

  const goTo = useCallback((index: number) => {
    if (animating || index === current) return
    setAnimating(true)
    setCurrent(index)
    setTimeout(() => setAnimating(false), 400)
  }, [animating, current])

  const next = useCallback(() => {
    goTo((current + 1) % total)
  }, [current, total, goTo])

  const prev = useCallback(() => {
    goTo((current - 1 + total) % total)
  }, [current, total, goTo])

  // Auto-play
  useEffect(() => {
    if (!autoPlay || paused || total <= 1) return
    const timer = setInterval(next, interval)
    return () => clearInterval(timer)
  }, [autoPlay, paused, total, next, interval])

  // Sin imágenes
  if (total === 0) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: compact ? '4/3' : '16/9',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, borderRadius: compact ? '16px 16px 0 0' : 16,
      }}>
        <span style={{ fontSize: compact ? '2.5rem' : '4rem' }}>🛍️</span>
        {!compact && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin imágenes</span>}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden',
        width: '100%', aspectRatio: compact ? '4/3' : '16/9',
        borderRadius: compact ? '16px 16px 0 0' : 16,
        background: '#0d1117',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {validImages.map((src, i) => (
        <div
          key={src}
          style={{
            position: 'absolute', inset: 0,
            opacity: i === current ? 1 : 0,
            transform: i === current ? 'scale(1)' : 'scale(1.04)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            zIndex: i === current ? 1 : 0,
          }}
        >
          {!imgErrors[i] ? (
            <Image
              src={src}
              alt={`${title} - foto ${i + 1}`}
              fill
              style={{ objectFit: 'cover' }}
              onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
              sizes={compact ? '(max-width: 768px) 100vw, 33vw' : '(max-width: 1024px) 100vw, 800px'}
              priority={i === 0}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            }}>
              <span style={{ fontSize: '2.5rem' }}>🖼️</span>
            </div>
          )}
        </div>
      ))}

      {/* Flechas — solo si hay más de 1 imagen */}
      {total > 1 && !compact && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            aria-label="Foto anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
            aria-label="Siguiente foto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </>
      )}

      {/* Dots indicadores */}
      {total > 1 && (
        <div style={{
          position: 'absolute', bottom: compact ? 8 : 14,
          left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: compact ? 5 : 7, zIndex: 10,
        }}>
          {validImages.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); goTo(i) }}
              style={{
                width: i === current ? (compact ? 18 : 24) : (compact ? 6 : 8),
                height: compact ? 6 : 8,
                borderRadius: 999, border: 'none', cursor: 'pointer',
                background: i === current ? '#6366f1' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                padding: 0,
              }}
              aria-label={`Ir a foto ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Contador fotos (solo compact) */}
      {total > 1 && compact && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          background: 'rgba(0,0,0,0.55)', borderRadius: 999,
          padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700, color: 'white',
          backdropFilter: 'blur(6px)',
        }}>
          {current + 1}/{total}
        </div>
      )}

      {/* Barra de progreso auto-play */}
      {total > 1 && autoPlay && !paused && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, zIndex: 10,
          background: 'rgba(255,255,255,0.15)',
        }}>
          <div
            key={current}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              animation: `progress ${interval}ms linear`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  )
}
