'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Listing } from '@/types'
import ImageCarousel from './ImageCarousel'

interface ListingCardProps {
  listing: Listing
  currentUserId?: string | null
  onReport?: (id: string) => void
}

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateChat } from '@/lib/chat'

export default function ListingCard({ listing, currentUserId, onReport }: ListingCardProps) {
  const router = useRouter()

  const [contacting, setContacting] = useState(false)
  const supabase = createClient()

  const handleContact = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!currentUserId) {
      router.push('/login')
      return
    }

    setContacting(true)

    // Check or Create chat
    const chatId = await getOrCreateChat(supabase, listing.id, currentUserId, listing.seller_id)

    if (!chatId) {
      alert('Error al iniciar conversación')
      setContacting(false)
      return
    }

    router.push(`/inbox/${chatId}`)
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(price)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    return `hace ${mins}m`
  }

  return (
    <div className="glass-card animate-fade-in-up" style={{
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      cursor: 'pointer', position: 'relative',
    }}>
      {/* Carousel */}
      <Link href={`/listings/${listing.id}`} style={{ textDecoration: 'none', display: 'block', position: 'relative' }}>
        <ImageCarousel
          images={listing.image_url ? [listing.image_url] : []}
          title={listing.title}
          compact
          interval={3500}
        />
        {/* Category badge overlay */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20 }}>
          <span className="badge badge-indigo">{listing.category}</span>
        </div>
      </Link>

      {/* Content */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <Link href={`/listings/${listing.id}`} style={{ textDecoration: 'none' }}>
          <h3 style={{
            fontSize: '0.95rem', fontWeight: 700,
            color: 'var(--text-primary)', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {listing.title}
          </h3>
        </Link>

        {listing.description && (
          <p style={{
            fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {listing.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
          <span className="price-tag">{formatPrice(listing.price)}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {timeAgo(listing.created_at)}
          </span>
        </div>

        {/* Seller info */}
        {listing.profiles && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {listing.profiles.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {listing.profiles.full_name || 'Vendedor UTA'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {currentUserId !== listing.seller_id && (
            <button 
              onClick={handleContact}
              disabled={contacting}
              className="btn-primary" 
              style={{ flex: 1, justifyContent: 'center', padding: '0.6rem', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '0.85rem' }}
            >
              {contacting ? 'Conectando...' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Contactar
                </>
              )}
            </button>
          )}
          {onReport && (
            <button
              onClick={() => onReport(listing.id)}
              title="Reportar publicación"
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '0.6rem', cursor: 'pointer', color: 'var(--accent-red)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
