'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PushManager from './PushManager'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfileData = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('avatar_url, role').eq('id', userId).single()
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
      if (data?.role === 'admin') setIsAdmin(true)
      else setIsAdmin(false)
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfileData(data.user.id)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfileData(session.user.id)
      else {
        setAvatarUrl(null)
        setIsAdmin(false)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let channel: any;

    const fetchUnreadCount = async (userId: string) => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', userId)
      setUnreadCount(count || 0)
    }

    if (user?.id) {
      fetchUnreadCount(user.id)
      
      channel = supabase.channel('navbar_unread')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          fetchUnreadCount(user.id)
        })
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id, supabase])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) => pathname === href

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'all 0.3s ease',
        background: scrolled
          ? 'rgba(8, 11, 20, 0.92)'
          : 'rgba(8, 11, 20, 0.6)',
        backdropFilter: 'blur(16px)',
        borderBottom: scrolled
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid transparent',
      }}
    >
      <PushManager user={user} />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: 'white',
              boxShadow: '0 0 16px rgba(99,102,241,0.4)',
            }}>U</div>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800, fontSize: '1.1rem',
              background: 'linear-gradient(135deg, #f0f4ff, #a5b4fc)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>U-Market</span>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="desktop-nav">
            <NavLink href="/" active={isActive('/')}>Explorar</NavLink>
            {user && <NavLink href="/dashboard" active={isActive('/dashboard')}>Mi Panel</NavLink>}
            {isAdmin && (
              <NavLink href="/admin" active={isActive('/admin')}>
                <span style={{ color: '#ef4444', fontWeight: isActive('/admin') ? 800 : 600 }}>🛡️ Admin</span>
              </NavLink>
            )}
            {user && <NavLink href="/listings/new" active={isActive('/listings/new')}>Publicar</NavLink>}
            {user && (
              <NavLink href="/inbox" active={isActive('/inbox') || pathname.startsWith('/inbox/')}>
                <span style={{ position: 'relative' }}>
                  Mensajes
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -12,
                      background: 'var(--accent-red, #ef4444)', color: 'white',
                      fontSize: '0.65rem', fontWeight: 'bold',
                      width: 16, height: 16, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
              </NavLink>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                <Link href="/profile" style={{ textDecoration: 'none' }} title="Mi Perfil">
                  <div style={{
                    width: 32, height: 32,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, color: 'white',
                    overflow: 'hidden',
                  }}>
                    {avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      user.email?.[0].toUpperCase()
                    )}
                  </div>
                </Link>
                <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  Salir
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                <Link href="/login">
                  <button className="btn-secondary" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                    Ingresar
                  </button>
                </Link>
                <Link href="/register">
                  <button className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                    Registrarse
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)', padding: 8, display: 'none',
            }}
            className="mobile-menu-btn"
            aria-label="Menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/></>
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            paddingBottom: '1rem',
            display: 'flex', flexDirection: 'column', gap: 4,
            borderTop: '1px solid var(--border)',
          }}>
            <MobileNavLink href="/" onClick={() => setMenuOpen(false)}>Explorar</MobileNavLink>
            {user && <MobileNavLink href="/dashboard" onClick={() => setMenuOpen(false)}>Mi Panel</MobileNavLink>}
            {isAdmin && (
              <MobileNavLink href="/admin" onClick={() => setMenuOpen(false)}>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>🛡️ Panel Admin</span>
              </MobileNavLink>
            )}
            {user && <MobileNavLink href="/listings/new" onClick={() => setMenuOpen(false)}>Publicar</MobileNavLink>}
            {user && (
              <MobileNavLink href="/inbox" onClick={() => setMenuOpen(false)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Mensajes
                  {unreadCount > 0 && (
                    <span style={{
                      background: 'var(--accent-red, #ef4444)', color: 'white',
                      fontSize: '0.65rem', fontWeight: 'bold',
                      padding: '2px 6px', borderRadius: 99
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
              </MobileNavLink>
            )}
            {user && <MobileNavLink href="/profile" onClick={() => setMenuOpen(false)}>Mi Perfil</MobileNavLink>}
            {user
              ? <button onClick={handleLogout} style={{ textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 600 }}>Cerrar sesión</button>
              : <>
                  <MobileNavLink href="/login" onClick={() => setMenuOpen(false)}>Ingresar</MobileNavLink>
                  <MobileNavLink href="/register" onClick={() => setMenuOpen(false)}>Registrarse</MobileNavLink>
                </>
            }
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      textDecoration: 'none',
      padding: '6px 14px',
      borderRadius: 8,
      fontSize: '0.875rem',
      fontWeight: active ? 600 : 500,
      color: active ? 'white' : 'var(--text-secondary)',
      background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
      transition: 'all 0.2s ease',
    }}
      onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = 'var(--text-secondary)' }}
    >
      {children}
    </Link>
  )
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={{
      textDecoration: 'none', display: 'block',
      padding: '10px 12px', borderRadius: 8,
      color: 'var(--text-primary)', fontWeight: 500,
    }}>
      {children}
    </Link>
  )
}
