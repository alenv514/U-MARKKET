'use client'

import { useState } from 'react'
import { submitReviewAction } from '@/actions/reviews'
import StarRating from './StarRating'

export default function ReviewForm({ revieweeId, currentUserId }: { revieweeId: string, currentUserId: string | undefined }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!currentUserId) {
    return (
      <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Inicia sesión para dejar una calificación.</p>
      </div>
    )
  }

  if (currentUserId === revieweeId) return null

  if (success) {
    return (
      <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <p style={{ color: '#34d399', fontWeight: 600 }}>¡Gracias por tu calificación!</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setError('Por favor selecciona de 1 a 5 estrellas.')
      return
    }

    setLoading(true)
    setError('')
    
    const res = await submitReviewAction(revieweeId, rating, comment)
    
    if (!res.success) {
      setError(res.error || 'Error al enviar la reseña.')
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Dejar una reseña</h3>
      
      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Tu calificación
        </label>
        <StarRating rating={rating} size={28} readonly={false} onChange={setRating} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Comentario (opcional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="¿Cómo fue tu experiencia con este vendedor?"
          className="input-field"
          style={{ minHeight: 80, resize: 'vertical' }}
          maxLength={300}
        />
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}

      <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', padding: '0.6rem 1.2rem' }}>
        {loading ? 'Enviando...' : 'Enviar calificación'}
      </button>
    </form>
  )
}
