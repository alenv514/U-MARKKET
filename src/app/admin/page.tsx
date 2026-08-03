'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Report, Profile } from '@/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { 
  approveSellerAction, 
  revokeSellerAction, 
  toggleFreePublishingAction, 
  toggleListingApprovalAction, 
  approveListingAction, 
  rejectListingAction,
  banUserAction,
  unbanUserAction,
  deleteUserAction
} from '@/actions/admin'

interface ReportWithListing extends Omit<Report, 'listings'> {
  listings: {
    id: string
    title: string
    seller_id: string
    status: string
  }
}

interface UserWithSub extends Profile {
  subscriptions: Array<{ plan: string; ends_at: string | null; is_active: boolean }>
}

export default function AdminPage() {
  const [reports, setReports] = useState<ReportWithListing[]>([])
  const [users, setUsers] = useState<UserWithSub[]>([])
  const [pendingListings, setPendingListings] = useState<any[]>([])
  const [stats, setStats] = useState({
    listings: { total: 0, active: 0, paused: 0, pending: 0 },
    users: { total: 0, sellers: 0, buyers: 0, admins: 0 },
    activeSubs: 0
  })
  const [weeklyStats, setWeeklyStats] = useState<any[]>([])
  const [weeklyStatsError, setWeeklyStatsError] = useState<string | null>(null)
  const [freePublishingMode, setFreePublishingMode] = useState(false)
  const [requireApprovalMode, setRequireApprovalMode] = useState(false)
  const [tab, setTab] = useState<'reports' | 'users' | 'approvals'>('reports')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [storageUsedMB, setStorageUsedMB] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role !== 'admin') { router.push('/dashboard'); return }
    setIsAdmin(true)

    const [reportsRes, usersRes, settingsRes, approvalSettingsRes, pendingListingsRes, weeklyStatsRes] = await Promise.all([
      supabase.from('reports')
        .select('*, listings(id, title, seller_id, status)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('*, subscriptions(plan, ends_at, is_active)')
        .order('created_at', { ascending: false }),
      supabase.from('platform_settings')
        .select('value')
        .eq('key', 'free_publishing_mode')
        .single(),
      supabase.from('platform_settings')
        .select('value')
        .eq('key', 'listings_require_approval')
        .single(),
      supabase.from('listings')
        .select('*, profiles(full_name, avatar_url)')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_weekly_stats')
    ])

    const [
      { count: totalListings },
      { count: activeListings },
      { count: pausedListings },
      { count: pendingListingsCount },
      { count: totalUsers },
      { count: sellerUsers },
      { count: buyerUsers },
      { count: adminUsers },
      { count: activeSubs }
    ] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'buyer'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    ])

    setStats({
      listings: { total: totalListings || 0, active: activeListings || 0, paused: pausedListings || 0, pending: pendingListingsCount || 0 },
      users: { total: totalUsers || 0, sellers: sellerUsers || 0, buyers: buyerUsers || 0, admins: adminUsers || 0 },
      activeSubs: activeSubs || 0
    })

    if (settingsRes.data) {
      setFreePublishingMode(settingsRes.data.value === 'true' || settingsRes.data.value === true)
    }

    if (approvalSettingsRes.data) {
      setRequireApprovalMode(approvalSettingsRes.data.value === 'true' || approvalSettingsRes.data.value === true)
    }

    if (weeklyStatsRes.error) {
      console.error('Error fetching weekly stats:', weeklyStatsRes.error)
      setWeeklyStatsError(weeklyStatsRes.error.message)
    } else if (weeklyStatsRes.data) {
      console.log('Weekly Stats Data:', weeklyStatsRes.data)
      const formattedStats = weeklyStatsRes.data.map((d: any) => {
        // Asegurar que la fecha se procese correctamente usando UTC para evitar desfases
        const date = new Date(d.day + 'T00:00:00Z')
        return {
          ...d,
          formattedDay: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`
        }
      })
      setWeeklyStats(formattedStats)
    }

    setReports((reportsRes.data as ReportWithListing[]) ?? [])
    setUsers((usersRes.data as UserWithSub[]) ?? [])
    setPendingListings((pendingListingsRes.data as any[]) ?? [])

    // Calcular espacio usado contando imágenes en storage
    try {
      const buckets = ['listings', 'avatars']
      let totalBytes = 0
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list('', { limit: 1000, offset: 0 })
        if (files) {
          // Listar recursivamente en subcarpetas (por user id)
          for (const folder of files) {
            if (!folder.id) {
              const { data: subFiles } = await supabase.storage.from(bucket).list(folder.name, { limit: 1000 })
              if (subFiles) totalBytes += subFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
            } else {
              totalBytes += folder.metadata?.size || 0
            }
          }
        }
      }
      setStorageUsedMB(Math.round(totalBytes / 1024 / 1024 * 10) / 10)
    } catch {
      setStorageUsedMB(0)
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRemoveListing = async (listingId: string, reportId: string) => {
    if (!confirm('¿Eliminar esta publicación?')) return
    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)
    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
  }

  const handleWarnSeller = async (reportId: string, sellerId: string) => {
    const reason = prompt('Motivo de la advertencia:')
    if (!reason) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Registrar la advertencia en la tabla de auditoría (Checkpoints 1/4)
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'warn_seller',
      target_id: sellerId,
      details: { reason, reportId }
    })

    // Actualizar el reporte a revisado
    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
    alert('⚠️ Advertencia registrada. El reporte ha sido marcado como revisado.')
  }

  const handleDismissReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
  }

  const handleApproveSeller = async (userId: string) => {
    if (!confirm('¿Activar 30 días de suscripción como vendedor para este usuario?')) return
    
    try {
      const res = await approveSellerAction(userId)
      if (res.success) {
        // Actualizar estado local
        setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u
          return {
            ...u,
            role: 'seller',
            subscriptions: [{ plan: 'paid', is_active: true, ends_at: res.endsAt }]
          }
        }))
        alert('Suscripción activada y registrada en auditoría.')
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleRevokeSeller = async (userId: string) => {
    if (!confirm('¿Quitar permisos de vendedor a este usuario?')) return
    
    try {
      const res = await revokeSellerAction(userId)
      if (res.success) {
        setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u
          return { ...u, role: 'buyer', subscriptions: [{ ...u.subscriptions[0], is_active: false }] }
        }))
        alert('Permisos revocados y registrados en auditoría.')
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleToggleFreeMode = async () => {
    const newState = !freePublishingMode
    if (!confirm(`¿${newState ? 'Activar' : 'Desactivar'} el modo de publicación libre global?`)) return
    
    setFreePublishingMode(newState)
    try {
      const res = await toggleFreePublishingAction(newState)
      if (!res.success) throw new Error('Falló la acción')
    } catch (error: any) {
      setFreePublishingMode(!newState) // Revert on error
      alert('Error al cambiar configuración: ' + error.message)
    }
  }

  const handleToggleRequireApproval = async () => {
    const newState = !requireApprovalMode
    if (!confirm(`¿${newState ? 'Activar' : 'Desactivar'} la aprobación obligatoria de publicaciones?`)) return
    
    setRequireApprovalMode(newState)
    try {
      const res = await toggleListingApprovalAction(newState)
      if (!res.success) throw new Error('Falló la acción')
    } catch (error: any) {
      setRequireApprovalMode(!newState) // Revert on error
      alert('Error al cambiar configuración: ' + error.message)
    }
  }

  const handleApproveListing = async (listingId: string) => {
    if (!confirm('¿Aprobar esta publicación para hacerla pública?')) return
    try {
      const res = await approveListingAction(listingId)
      if (res.success) {
        setPendingListings(prev => prev.filter(l => l.id !== listingId))
        setStats(prev => ({
          ...prev,
          listings: {
            ...prev.listings,
            active: prev.listings.active + 1,
            pending: Math.max(0, prev.listings.pending - 1)
          }
        }))
        alert('Publicación aprobada con éxito.')
      }
    } catch (error: any) {
      alert('Error al aprobar: ' + error.message)
    }
  }

  const handleRejectListing = async (listingId: string) => {
    if (!confirm('¿Rechazar y eliminar esta publicación?')) return
    try {
      const res = await rejectListingAction(listingId)
      if (res.success) {
        setPendingListings(prev => prev.filter(l => l.id !== listingId))
        setStats(prev => ({
          ...prev,
          listings: {
            ...prev.listings,
            pending: Math.max(0, prev.listings.pending - 1)
          }
        }))
        alert('Publicación rechazada y eliminada.')
      }
    } catch (error: any) {
      alert('Error al rechazar: ' + error.message)
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm('¿Banear a este usuario? Se suspenderá su cuenta y se eliminarán todas sus publicaciones activas de inmediato.')) return
    try {
      const res = await banUserAction(userId)
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
        alert('Usuario suspendido y publicaciones retiradas con éxito.')
      }
    } catch (error: any) {
      alert('Error al suspender: ' + error.message)
    }
  }

  const handleUnbanUser = async (userId: string) => {
    if (!confirm('¿Reactivar la cuenta de este usuario?')) return
    try {
      const res = await unbanUserAction(userId)
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u))
        alert('Cuenta de usuario reactivada con éxito.')
      }
    } catch (error: any) {
      alert('Error al reactivar: ' + error.message)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = confirm(`⚠️ ELIMINAR USUARIO PERMANENTEMENTE\n\n¿Estás seguro de que deseas eliminar a "${userName}"?\n\nEsto eliminará:\n• Su cuenta de acceso\n• Su perfil\n• Todas sus publicaciones\n• Sus suscripciones\n\nEsta acción NO SE PUEDE DESHACER.`)
    if (!confirmed) return
    try {
      await deleteUserAction(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      alert('Usuario eliminado permanentemente.')
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message)
    }
  }

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    const nameMatch = user.full_name?.toLowerCase().includes(q)
    const emailMatch = user.email?.toLowerCase().includes(q)
    return nameMatch || emailMatch
  })

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 64, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem' }}>

          {/* Header */}
          <div className="animate-fade-in-up" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span className="badge badge-red">🛡️ Admin</span>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Panel de Administración</h1>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Gestiona reportes, usuarios y suscripciones de U-Market
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                onClick={handleToggleFreeMode} 
                className={freePublishingMode ? 'btn-danger' : 'btn-primary'}
                style={{ fontWeight: 700, padding: '0.625rem 1.25rem' }}
              >
                {freePublishingMode ? '🔴 Desactivar Publicación Libre' : '🟢 Activar Publicación Libre'}
              </button>
              <button 
                onClick={handleToggleRequireApproval} 
                className={requireApprovalMode ? 'btn-danger' : 'btn-primary'}
                style={{ fontWeight: 700, padding: '0.625rem 1.25rem', background: requireApprovalMode ? undefined : 'linear-gradient(135deg, var(--accent-amber), #d97706)' }}
              >
                {requireApprovalMode ? '🔴 Desactivar Aprobación' : '🛡️ Activar Aprobación'}
              </button>
            </div>
          </div>

          {freePublishingMode && (
            <div className="animate-fade-in-up" style={{
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: 12, color: '#ef4444'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <h3 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>Modo "Publicación Libre" Activado</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Todos los usuarios pueden publicar sin suscripción. (Se configurará en Checkpoint 6)</p>
              </div>
            </div>
          )}

          {/* Stats bar */}
          <div className="animate-fade-in-up delay-100" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#3b82f6' }}>{stats.listings.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publicaciones Totales</div>
              <div style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-secondary)' }}>
                <span style={{ color: '#10b981' }}>{stats.listings.active} activas</span> • <span style={{ color: '#f59e0b' }}>{stats.listings.paused} pausadas</span>
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#8b5cf6' }}>{stats.users.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usuarios Registrados</div>
              <div style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-secondary)' }}>
                <span style={{ color: '#6366f1' }}>{stats.users.sellers} vendedores</span> • <span>{stats.users.buyers} compradores</span> • <span style={{ color: '#ef4444' }}>{stats.users.admins} admins</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981' }}>{stats.activeSubs}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suscripciones Activas</div>
            </div>

            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444' }}>{reports.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reportes Pendientes</div>
            </div>

            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f59e0b' }}>{stats.listings.pending}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publicaciones por Aprobar</div>
            </div>

            {/* Storage indicator */}
            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default', borderColor: storageUsedMB !== null && storageUsedMB > 800 ? 'rgba(239,68,68,0.4)' : storageUsedMB !== null && storageUsedMB > 600 ? 'rgba(245,158,11,0.4)' : undefined }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: storageUsedMB !== null && storageUsedMB > 800 ? '#ef4444' : storageUsedMB !== null && storageUsedMB > 600 ? '#f59e0b' : '#06b6d4' }}>
                {storageUsedMB !== null ? `${storageUsedMB} MB` : '...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Almacenamiento Usado</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 4,
                    width: storageUsedMB !== null ? `${Math.min((storageUsedMB / 1024) * 100, 100)}%` : '0%',
                    background: storageUsedMB !== null && storageUsedMB > 800 ? '#ef4444' : storageUsedMB !== null && storageUsedMB > 600 ? '#f59e0b' : '#06b6d4',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  {storageUsedMB !== null ? `${((storageUsedMB / 1024) * 100).toFixed(1)}% de 1 GB (plan free)` : 'Calculando...'}
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Stats Chart */}
          <div className="animate-fade-in-up delay-200" style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Actividad Semanal</h2>
            <div className="glass-card" style={{ padding: '1.5rem', height: 350 }}>
              {weeklyStatsError ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</span>
                  <strong>Falta la función en la base de datos</strong>
                  <p style={{ fontSize: '0.85rem', maxWidth: 400, marginTop: '0.5rem' }}>
                    Asegúrate de ejecutar la consulta SQL de `get_weekly_stats` en el SQL Editor de Supabase (paso indicado en el Checkpoint 3).<br/>
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Error: {weeklyStatsError}</span>
                  </p>
                </div>
              ) : weeklyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyStats} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="formattedDay" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ background: 'rgba(8, 11, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                      itemStyle={{ color: '#fff', fontWeight: 600 }}
                      labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 20 }} />
                    <Line type="monotone" name="Nuevas Publicaciones" dataKey="new_listings" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#080b14' }} activeDot={{ r: 6, fill: '#3b82f6' }} />
                    <Line type="monotone" name="Nuevos Usuarios" dataKey="new_users" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#080b14' }} activeDot={{ r: 6, fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Cargando estadísticas...
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'var(--bg-card)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
            {(['reports', 'users', 'approvals'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s ease',
                background: tab === t ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                color: tab === t ? 'white' : 'var(--text-secondary)',
              }}>
                {t === 'reports' ? `Reportes (${reports.length})` : t === 'users' ? `Usuarios (${filteredUsers.length})` : `Aprobaciones (${pendingListings.length})`}
              </button>
            ))}
          </div>

          {/* Reports tab */}
          {tab === 'reports' && (
            <div className="animate-fade-in">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
                </div>
              ) : reports.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                  <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin reportes pendientes</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¡La plataforma está limpia!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {reports.map(report => (
                    <div key={report.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.95rem' }}>
                          📦 {report.listings?.title ?? 'Publicación eliminada'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                          Razón: <strong style={{ color: 'var(--text-primary)' }}>{report.reason}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(report.created_at).toLocaleDateString('es-EC')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => handleDismissReport(report.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                          Ignorar
                        </button>
                        {report.listings?.seller_id && (
                          <button onClick={() => handleWarnSeller(report.id, report.listings.seller_id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#f59e0b' }}>
                            Advertir Vendedor
                          </button>
                        )}
                        <button onClick={() => handleRemoveListing(report.listings?.id, report.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                          Eliminar listing
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Buscador por Correo / Nombre */}
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <span style={{
                  position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar por correo o nombre..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{
                    paddingLeft: '2.75rem', paddingRight: '1rem',
                    fontSize: '0.9rem', borderRadius: 12,
                    background: 'rgba(255,255,255,0.05)',
                  }}
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No se encontraron usuarios que coincidan con "{searchQuery}"
                </div>
              ) : (
                filteredUsers.map(user => {
                  const sub = user.subscriptions?.find(s => s.is_active) || user.subscriptions?.[0]
                  const subActive = sub?.is_active && (!sub.ends_at || new Date(sub.ends_at) > new Date())
                  return (
                    <div key={user.id} className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.9rem', fontWeight: 700, color: 'white', flexShrink: 0,
                      }}>
                        {user.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
                          {user.full_name || 'Sin nombre'}
                        </div>
                        {user.email && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            📧 {user.email}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {user.is_active === false && (
                            <span className="badge badge-red">
                              🚫 Suspendido
                            </span>
                          )}
                          <span className={`badge ${user.role === 'admin' ? 'badge-red' : user.role === 'seller' ? 'badge-indigo' : 'badge-amber'}`}>
                            {user.role}
                          </span>
                          <span className={`badge ${subActive ? 'badge-green' : 'badge-amber'}`}>
                            {subActive ? `✅ ${sub?.plan ?? 'free'}` : '⏱ sin sub'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {user.role !== 'admin' && (
                          <>
                            {user.is_active === false ? (
                              <button
                                onClick={() => handleUnbanUser(user.id)}
                                className="btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981' }}
                              >
                                🟢 Activar Cuenta
                              </button>
                            ) : (
                              <>
                                {user.role === 'buyer' || !subActive ? (
                                  <button
                                    onClick={() => handleApproveSeller(user.id)}
                                    className="btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981' }}
                                  >
                                    ✅ Aprobar Vendedor (30 días)
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRevokeSeller(user.id)}
                                    className="btn-danger"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                  >
                                    ❌ Revocar Vendedor
                                  </button>
                                )}
                                <button
                                  onClick={() => handleBanUser(user.id)}
                                  className="btn-danger"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#ef4444' }}
                                >
                                  🚫 Banear
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.full_name || user.email || 'Usuario')}
                            style={{
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              background: 'rgba(127,29,29,0.4)',
                              border: '1px solid rgba(239,68,68,0.35)',
                              borderRadius: 8,
                              color: '#fca5a5',
                              cursor: 'pointer',
                              fontWeight: 700,
                              transition: 'background 0.2s',
                            }}
                            title="Eliminar usuario permanentemente"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Approvals tab */}
          {tab === 'approvals' && (
            <div className="animate-fade-in">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
                </div>
              ) : pendingListings.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
                  <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin publicaciones pendientes</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¡Todo al día!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingListings.map(listing => (
                    <div key={listing.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      {/* Image thumb */}
                      <div style={{
                        width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                        background: listing.image_url
                          ? `url(${listing.image_url}) center/cover`
                          : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                      }}>
                        {!listing.image_url && '📦'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                          {listing.title}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ color: 'var(--accent-amber)', fontWeight: 800, fontSize: '0.9rem' }}>
                            ${listing.price}
                          </span>
                          <span className="badge badge-indigo">
                            {listing.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Por: <strong>{listing.profiles?.full_name || 'Vendedor UTA'}</strong>
                          </span>
                        </div>
                        {listing.description && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                            {listing.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <a href={`/listings/${listing.id}`} target="_blank" style={{ textDecoration: 'none' }}>
                          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                            👁️ Ver Detalles
                          </button>
                        </a>
                        <button onClick={() => handleApproveListing(listing.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#10b981' }}>
                          ✅ Aprobar
                        </button>
                        <button onClick={() => handleRejectListing(listing.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
