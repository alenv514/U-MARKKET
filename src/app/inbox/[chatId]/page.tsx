'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Chat, Message } from '@/types'
import Link from 'next/link'
import { sendNotificationAction } from '@/actions/notifications'

export default function ChatDetailPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const router = useRouter()
  const supabase = createClient()
  
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    let channel: any

    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch chat details
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select(`
          *,
          listings(id, title, image_url, price),
          buyer:buyer_id(id, full_name, avatar_url),
          seller:seller_id(id, full_name, avatar_url)
        `)
        .eq('id', chatId)
        .single()

      if (chatError || !chatData) {
        setLoading(false)
        return
      }

      setChat(chatData as Chat)

      // Fetch existing messages
      const { data: msgsData } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (msgsData) {
        setMessages(msgsData as Message[])
        
        // Marcar mensajes no leídos como leídos
        const unreadIds = msgsData
          .filter(m => !m.is_read && m.sender_id !== user.id)
          .map(m => m.id)
          
        if (unreadIds.length > 0) {
          await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
        }
      }

      setLoading(false)

      // Limpiar canal previo si quedó huérfano (problema común con React StrictMode y async useEffects)
      const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:chat_${chatId}`)
      if (existingChannel) {
        supabase.removeChannel(existingChannel)
      }

      // Subscribe to new messages
      channel = supabase
        .channel(`chat_${chatId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload) => {
            const newMsg = payload.new as Message
            setMessages(prev => [...prev, newMsg])
            
            // Si el mensaje es recibido, marcarlo como leído automáticamente
            if (newMsg.sender_id !== user.id) {
              supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then()
            }
          }
        )
        .subscribe()
    }

    setupChat()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [chatId, router, supabase])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userId || !chat) return

    const content = newMessage.trim()
    setNewMessage('') // Optimistic clear

    const { error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: content
      })

    if (error) {
      alert('Error enviando mensaje: ' + error.message)
    } else {
      // Disparar notificacion por correo de forma asíncrona (sin await)
      if (otherUser?.id) {
        // Necesitamos el nombre de nuestro usuario (el sender)
        const myName = isBuyer ? chat.buyer?.full_name : chat.seller?.full_name
        
        sendNotificationAction(
          otherUser.id,
          otherUser.full_name || 'Usuario',
          myName || 'Alguien',
          content,
          chat.listings?.title || 'tu publicación',
          `${window.location.origin}/inbox/${chatId}`
        ).catch(console.error)
      }
    }
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

  if (!chat) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Chat no encontrado o sin permisos</h2>
            <Link href="/inbox"><button className="btn-primary" style={{ marginTop: '1rem' }}>Volver</button></Link>
          </div>
        </main>
      </>
    )
  }

  const isBuyer = chat.buyer_id === userId
  const otherUser = isBuyer ? chat.seller : chat.buyer

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 800, width: '100%', margin: '0 auto', background: 'var(--bg-card)' }}>
          
          {/* Header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(8,11,20,0.8)', backdropFilter: 'blur(10px)' }}>
            <button onClick={() => router.push('/inbox')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 700, color: 'white', overflow: 'hidden'
            }}>
              {otherUser?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={otherUser.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                otherUser?.full_name?.[0]?.toUpperCase() ?? 'U'
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{otherUser?.full_name || 'Usuario UTA'}</div>
              <Link href={`/listings/${chat.listing_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-indigo)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📦 {chat.listings?.title}
                </div>
              </Link>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                Envía un mensaje para comenzar la conversación sobre <strong>{chat.listings?.title}</strong>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.sender_id === userId
                return (
                  <div key={msg.id} style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      background: isMe ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.08)',
                      color: isMe ? 'white' : 'var(--text-primary)',
                      fontSize: '0.95rem',
                      lineHeight: 1.4,
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 4 }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && (
                        <span>{msg.is_read ? '✓✓' : '✓'}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="input-field"
              style={{ flex: 1, borderRadius: 24, padding: '0.75rem 1.25rem' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: newMessage.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--border)',
                color: 'white', cursor: newMessage.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'all 0.2s'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: -2 }}>
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>

        </div>
      </main>
    </>
  )
}
