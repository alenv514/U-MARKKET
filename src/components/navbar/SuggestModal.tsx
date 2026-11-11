'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

interface SuggestModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SuggestModal({ isOpen, onClose }: SuggestModalProps) {
  const [suggestion, setSuggestion] = useState('')

  if (!isOpen || typeof window === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(10, 37, 64, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in-up"
        style={{
          maxWidth: 480,
          width: '90%',
          padding: '2.5rem 2rem',
          borderRadius: 24,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px rgba(10, 37, 64, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>💡</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0a192f', textAlign: 'center' }}>
          ¿Tienes una recomendación?
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.88rem',
            lineHeight: 1.6,
            marginBottom: '1.25rem',
            textAlign: 'center',
          }}
        >
          Escríbenos qué mejorarías o qué función te gustaría ver en U-Market. Tu mensaje llegará directo al desarrollador.
        </p>

        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          placeholder="Ej: Me gustaría que hubiera un filtro por facultad..."
          rows={4}
          style={{
            width: '100%',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            color: '#0a192f',
            fontSize: '0.9rem',
            padding: '0.85rem 1rem',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            marginBottom: '1rem',
          }}
        />

        <a
          href={
            suggestion.trim()
              ? `https://wa.me/593999752932?text=${encodeURIComponent(
                  '💡 Recomendación para U-Market:\n\n' + suggestion.trim()
                )}`
              : '#'
          }
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!suggestion.trim()) {
              e.preventDefault()
              return
            }
            onClose()
            setSuggestion('')
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: suggestion.trim() ? '#25D366' : 'rgba(37,211,102,0.25)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.95rem',
            padding: '0.85rem 1.75rem',
            borderRadius: 99,
            textDecoration: 'none',
            boxShadow: suggestion.trim() ? '0 8px 24px rgba(37,211,102,0.35)' : 'none',
            transition: 'all 0.2s ease',
            cursor: suggestion.trim() ? 'pointer' : 'not-allowed',
            pointerEvents: suggestion.trim() ? 'auto' : 'none',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>💬</span>
          Enviar por WhatsApp
        </a>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Escribe tu sugerencia para activar el botón de envío.
        </p>
      </div>
    </div>,
    document.body
  )
}
