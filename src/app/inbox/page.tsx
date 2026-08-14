'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Chat } from '@/types'

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchChats = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('chats')
      .select(`
        *,
        listings(title, image_url),
        buyer:buyer_id(id, full_name, avatar_url),
        seller:seller_id(id, full_name, avatar_url),
        messages(content, is_read, sender_id, created_at)
      `)
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order('updated_at', { ascending: false })
      .order('created_at', { referencedTable: 'messages', ascending: false })
      .limit(1, { referencedTable: 'messages' })

    if (data) setChats(data as Chat[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchChats(data.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [supabase, fetchChats])

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string, otherUserName: string) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmed = window.confirm(
      `¿Eliminar conversación con ${otherUserName}?\n\nSe borrarán todos los mensajes. Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    setDeletingId(chatId)

    // Borrar mensajes primero, luego el chat
    await supabase.from('messages').delete().eq('chat_id', chatId)
    const { error } = await supabase.from('chats').delete().eq('id', chatId)

    if (!error) {
      setChats(prev => prev.filter(c => c.id !== chatId))
    } else {
      alert('No se pudo eliminar la conversación. Inténtalo de nuevo.')
    }

    setDeletingId(null)
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        </main>
      </>
    )
  }

  if (!userId) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Debes iniciar sesión para ver tus mensajes</h2>
            <Link href="/login"><button className="btn-primary" style={{ marginTop: '1rem' }}>Ir al Login</button></Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem', maxWidth: 800 }}>

          <div className="animate-fade-in-up" style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 4 }}>
              Mensajes 💬
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Tus conversaciones con otros estudiantes
            </p>
          </div>

          <div className="animate-fade-in-up delay-100" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {chats.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Bandeja vacía</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Aún no tienes mensajes</p>
              </div>
            ) : (
              chats.map(chat => {
                const isBuyer = chat.buyer_id === userId
                const otherUser = isBuyer ? chat.seller : chat.buyer
                const lastMessage = chat.messages?.[0]
                const unread = lastMessage && !lastMessage.is_read && lastMessage.sender_id !== userId
                const isDeleting = deletingId === chat.id

                return (
                  <div key={chat.id} style={{ position: 'relative' }}>
                    <Link href={`/inbox/${chat.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        className="glass-card"
                        style={{
                          padding: '1.25rem',
                          paddingRight: '4rem', // espacio para el botón eliminar
                          display: 'flex', alignItems: 'center', gap: '1rem',
                          border: unread ? '1px solid rgba(99,102,241,0.5)' : undefined,
                          background: unread ? 'rgba(99,102,241,0.05)' : undefined,
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          opacity: isDeleting ? 0.4 : 1,
                        }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.2rem', fontWeight: 700, color: 'white', overflow: 'hidden'
                        }}>
                          {otherUser?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={otherUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            otherUser?.full_name?.[0]?.toUpperCase() ?? 'U'
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontWeight: unread ? 800 : 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {otherUser?.full_name || 'Usuario UTA'}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: unread ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                              {lastMessage ? new Date(lastMessage.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-indigo)', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📦 {chat.listings?.title}
                          </div>
                          <div style={{
                            fontSize: '0.85rem',
                            color: unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: unread ? 600 : 400,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {lastMessage ? (
                              <>
                                {lastMessage.sender_id === userId ? 'Tú: ' : ''}
                                {lastMessage.content}
                              </>
                            ) : (
                              <i style={{ color: 'var(--text-muted)' }}>Sin mensajes aún</i>
                            )}
                          </div>
                        </div>

                        {/* Punto de no leído */}
                        {unread && (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                        )}
                      </div>
                    </Link>

                    {/* Botón Eliminar (fuera del Link) */}
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id, otherUser?.full_name || 'este usuario')}
                      disabled={isDeleting}
                      title="Eliminar conversación"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: '1rem',
                        transform: 'translateY(-50%)',
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)',
                        color: isDeleting ? 'rgba(239,68,68,0.3)' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '0.95rem',
                        zIndex: 10,
                      }}
                      onMouseEnter={e => {
                        if (!isDeleting) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.22)'
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.6)'
                        }
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)'
                      }}
                    >
                      {isDeleting ? '⏳' : '🗑️'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </>
  )
}

