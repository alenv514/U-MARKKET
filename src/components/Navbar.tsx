'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import PushManager from './PushManager'
import { NavLink } from './navbar/NavLinks'
import PWAInstallModal from './navbar/PWAInstallModal'
import BusinessModal from './navbar/BusinessModal'
import SuggestModal from './navbar/SuggestModal'
import MobileNavMenu from './navbar/MobileNavMenu'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isModerator, setIsModerator] = useState(false)
  const [showBusinessModal, setShowBusinessModal] = useState(false)
  const [isInstalled, setIsInstalled] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  // Detect PWA Installation State
  useEffect(() => {
    const checkIsStandalone = () => {
      if (typeof window === 'undefined') return false
      const nav = window.navigator as NavigatorWithStandalone
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        nav.standalone === true ||
        document.referrer.includes('android-app://')
      )
    }

    const isStandaloneMode = checkIsStandalone()
    setIsInstalled(isStandaloneMode)

    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !((window as unknown as { MSStream?: unknown }).MSStream)
    setIsIOS(isIosDevice)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstalled(false)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowInstallModal(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true)
    }
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange)
      }
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setDeferredPrompt(null)
      }
    } else {
      setShowInstallModal(true)
    }
  }

  useEffect(() => {
    const fetchProfileData = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('avatar_url, role').eq('id', userId).single()
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
      if (data?.role === 'admin') {
        setIsAdmin(true)
        setIsModerator(false)
      } else if (data?.role === 'moderator') {
        setIsModerator(true)
        setIsAdmin(false)
      } else {
        setIsAdmin(false)
        setIsModerator(false)
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfileData(data.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfileData(session.user.id)
      else {
        setAvatarUrl(null)
        setIsAdmin(false)
        setIsModerator(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const refreshUnreadCount = useCallback(
    async (userId: string) => {
      try {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', userId)
        setUnreadCount(count || 0)
      } catch {
        // Ignorar fallos transitorios de red
      }
    },
    [supabase]
  )

  useEffect(() => {
    if (!user?.id) return

    refreshUnreadCount(user.id)

    const onFocus = () => refreshUnreadCount(user.id)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount(user.id)
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount(user.id)
      }
    }, 45_000)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [user?.id, refreshUnreadCount, pathname])

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
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s ease',
        background: scrolled ? 'rgba(10, 37, 64, 0.98)' : '#0a2540',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: scrolled ? '0 4px 20px rgba(10, 37, 64, 0.3)' : '0 2px 10px rgba(10, 37, 64, 0.15)',
      }}
    >
      <PushManager user={user} />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: '#ffffff',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.05rem',
                fontWeight: 900,
                color: '#0a2540',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              }}
            >
              U
            </div>
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: '1.15rem',
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              U-Market
            </span>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="desktop-nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Botón Sugerencias */}
              <button
                onClick={() => setShowSuggestModal(true)}
                title="Enviar una recomendación o sugerencia"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#fcd34d',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                💡
              </button>
              {/* Botón Negocios Externos */}
              <button
                onClick={() => setShowBusinessModal(true)}
                title="¿Tienes un negocio externo? Haz clic aquí"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#93c5fd',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                ❓
              </button>

              {/* Botón Descargar / Instalar App */}
              {!isInstalled && (
                <button
                  onClick={handleInstallClick}
                  title="Descargar e instalar U-Market en tu dispositivo"
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    borderRadius: 20,
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Descargar App</span>
                </button>
              )}

              <NavLink href="/" active={isActive('/')}>
                Explorar
              </NavLink>
            </div>
            {user && (
              <NavLink href="/dashboard" active={isActive('/dashboard')}>
                Mi Panel
              </NavLink>
            )}
            {isAdmin && (
              <NavLink href="/admin" active={isActive('/admin')}>
                <span style={{ color: '#ef4444', fontWeight: isActive('/admin') ? 800 : 600 }}>🛡️ Admin</span>
              </NavLink>
            )}
            {isModerator && (
              <NavLink href="/admin" active={isActive('/admin')}>
                <span style={{ color: '#f59e0b', fontWeight: isActive('/admin') ? 800 : 600 }}>🛡️ Moderador</span>
              </NavLink>
            )}
            {user && (
              <NavLink href="/listings/new" active={isActive('/listings/new')}>
                Publicar
              </NavLink>
            )}
            {user && (
              <NavLink href="/inbox" active={isActive('/inbox') || pathname.startsWith('/inbox/')}>
                <span style={{ position: 'relative' }}>
                  Mensajes
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -12,
                        background: 'var(--accent-red, #ef4444)',
                        color: 'white',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </span>
              </NavLink>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                <Link href="/profile" style={{ textDecoration: 'none' }} title="Mi Perfil">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: 'linear-gradient(135deg, #0a2540, #0052cc)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'white',
                      overflow: 'hidden',
                    }}
                  >
                    {avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      user.email?.[0].toUpperCase()
                    )}
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Salir
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                <Link href="/login">
                  <button
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      color: '#ffffff',
                      padding: '6px 16px',
                      fontSize: '0.85rem',
                      borderRadius: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    Ingresar
                  </button>
                </Link>
                <Link href="/register">
                  <button
                    style={{
                      background: '#ffffff',
                      color: '#0a2540',
                      border: 'none',
                      padding: '6px 16px',
                      fontSize: '0.85rem',
                      borderRadius: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
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
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: 8,
              display: 'none',
            }}
            className="mobile-menu-btn"
            aria-label="Menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="8" x2="21" y2="8" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="16" x2="21" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu drawer */}
        <MobileNavMenu
          isOpen={menuOpen}
          isInstalled={isInstalled}
          user={user}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
          onClose={() => setMenuOpen(false)}
          onInstallClick={handleInstallClick}
          onOpenSuggestModal={() => setShowSuggestModal(true)}
          onOpenBusinessModal={() => setShowBusinessModal(true)}
          onLogout={handleLogout}
        />
      </div>

      <PWAInstallModal
        isOpen={showInstallModal}
        isIOS={isIOS}
        onClose={() => setShowInstallModal(false)}
      />

      <BusinessModal
        isOpen={showBusinessModal}
        onClose={() => setShowBusinessModal(false)}
      />

      <SuggestModal
        isOpen={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
      />

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}
