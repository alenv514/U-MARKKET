'use client'

import { createPortal } from 'react-dom'

interface BusinessModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function BusinessModal({ isOpen, onClose }: BusinessModalProps) {
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
        background: 'rgba(0, 0, 0, 0.78)',
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
          background: '#0d121f',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          position: 'relative',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'var(--text-secondary)',
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

        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💼</div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.75rem', color: '#ffffff' }}>
          ¿Tienes un negocio o marca externa?
        </h2>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            marginBottom: '1.75rem',
          }}
        >
          ¿No eres estudiante de la UTA pero te gustaría vender o promocionar tu negocio en U-Market? Solicita
          autorización a la administración a través de nuestro WhatsApp oficial.
        </p>

        <a
          href="https://wa.me/593999752932?text=Hola!%20Tengo%20un%20negocio%20externo%20y%20me%20gustar%C3%ADa%20publicar/anunciarme%20en%20U-Market."
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: '#25D366',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.95rem',
            padding: '0.85rem 1.75rem',
            borderRadius: 99,
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(37, 211, 102, 0.35)',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>💬</span>
          Contactar por WhatsApp
        </a>
      </div>
    </div>,
    document.body
  )
}
