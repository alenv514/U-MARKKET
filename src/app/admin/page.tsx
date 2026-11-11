'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import {
  approveSellerAction,
  revokeSellerAction,
  toggleFreePublishingAction,
  toggleListingApprovalAction,
  approveListingAction,
  rejectListingAction,
  banUserAction,
  unbanUserAction,
  deleteUserAction,
  assignModeratorAction,
  revokeModeratorAction,
  getUsersForAdminAction,
} from '@/actions/admin'
import { reviewVerificationAction, getFeatureFlagAction, setFeatureFlagAction } from '@/actions/verification'

import type { ReportWithListing, UserWithSub, PendingListing, WeeklyStatItem, AdminStats } from './types'
import AdminHeader from './components/AdminHeader'
import AdminStatsGrid from './components/AdminStatsGrid'
import ReportsTab from './components/ReportsTab'
import UsersTab from './components/UsersTab'
import ApprovalsTab from './components/ApprovalsTab'
import VerificationsTab from './components/VerificationsTab'
import ZoomModal from './components/ZoomModal'
import { exportAdminReportToExcel } from './utils/exportExcel'

export default function AdminPage() {
  const [reports, setReports] = useState<ReportWithListing[]>([])
  const [users, setUsers] = useState<UserWithSub[]>([])
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([])
  const [verifications, setVerifications] = useState<Profile[]>([])
  const [verificationFeatureEnabled, setVerificationFeatureEnabled] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [stats, setStats] = useState<AdminStats>({
    listings: { total: 0, active: 0, paused: 0, pending: 0 },
    users: { total: 0, sellers: 0, buyers: 0, admins: 0 },
    activeSubs: 0,
  })
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([])
  const [weeklyStatsError, setWeeklyStatsError] = useState<string | null>(null)
  const [freePublishingMode, setFreePublishingMode] = useState(false)
  const [requireApprovalMode, setRequireApprovalMode] = useState(false)
  const [tab, setTab] = useState<'reports' | 'users' | 'approvals' | 'verifications'>('reports')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [storageUsedMB, setStorageUsedMB] = useState<number | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role !== 'admin' && profile?.role !== 'moderator') { router.push('/dashboard'); return }
    setIsAdmin(profile?.role === 'admin')

    const [
      reportsRes,
      usersRes,
      settingsRes,
      approvalSettingsRes,
      pendingListingsRes,
      weeklyStatsRes,
      verificationsRes,
      verificationFlagRes,
    ] = await Promise.all([
      supabase.from('reports')
        .select('*, listings(id, title, seller_id, status)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      getUsersForAdminAction(),
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
      supabase.rpc('get_weekly_stats'),
      supabase.from('profiles')
        .select('*')
        .eq('verification_status', 'pending')
        .order('verification_submitted_at', { ascending: false }),
      getFeatureFlagAction('student_verification_enabled'),
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
      { count: activeSubs },
    ] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`),
    ])

    setStats({
      listings: {
        total: totalListings || 0,
        active: activeListings || 0,
        paused: pausedListings || 0,
        pending: pendingListingsCount || 0,
      },
      users: {
        total: totalUsers || 0,
        sellers: sellerUsers || 0,
        buyers: buyerUsers || 0,
        admins: adminUsers || 0,
      },
      activeSubs: activeSubs || 0,
    })

    if (verificationsRes.data) {
      setVerifications(verificationsRes.data as Profile[])
    }
    setVerificationFeatureEnabled(verificationFlagRes.enabled ?? false)

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
      const formattedStats = (weeklyStatsRes.data as Array<{ day: string; [key: string]: unknown }>).map((d) => {
        const date = new Date(d.day + 'T00:00:00Z')
        return {
          ...d,
          formattedDay: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
        }
      })
      setWeeklyStats(formattedStats)
    }

    setReports((reportsRes.data as ReportWithListing[]) ?? [])
    setUsers((usersRes.users as UserWithSub[]) ?? [])
    setPendingListings((pendingListingsRes.data as PendingListing[]) ?? [])

    try {
      const buckets = ['listings', 'avatars']
      let totalBytes = 0
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list('', { limit: 1000, offset: 0 })
        if (files) {
          for (const item of files) {
            if (!item.id) {
              const { data: subFiles } = await supabase.storage.from(bucket).list(item.name, { limit: 1000 })
              if (subFiles) {
                for (const sub of subFiles) {
                  const size = sub.metadata?.size
                  if (typeof size === 'number') totalBytes += size
                }
              }
            } else {
              const size = item.metadata?.size
              if (typeof size === 'number') totalBytes += size
            }
          }
        }
      }
      setStorageUsedMB(Math.round(totalBytes / 1024 / 1024 * 10) / 10)
    } catch {
      setStorageUsedMB(0)
    }

    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    let mounted = true
    if (mounted) {
      fetchData()
    }
    return () => { mounted = false }
  }, [fetchData])

  const handleRemoveListing = async (listingId: string | undefined, reportId: string) => {
    if (!listingId || !confirm('¿Eliminar esta publicación?')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'remove_listing_report',
      target_id: listingId,
      details: { reportId },
    })
    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }

  const handleWarnSeller = async (reportId: string, sellerId: string) => {
    const reason = prompt('Motivo de la advertencia:')
    if (!reason) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'warn_seller',
      target_id: sellerId,
      details: { reason, reportId },
    })

    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
    setReports((prev) => prev.filter((r) => r.id !== reportId))
    alert('⚠️ Advertencia registrada. El reporte ha sido marcado como revisado.')
  }

  const handleDismissReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId)
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }

  const handleApproveSeller = async (userId: string) => {
    if (!confirm('¿Activar 30 días de suscripción como vendedor para este usuario?')) return

    try {
      const res = await approveSellerAction(userId)
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u
            return {
              ...u,
              role: 'seller',
              subscriptions: [{ plan: 'paid', is_active: true, ends_at: res.endsAt }],
            }
          })
        )
        alert('Suscripción activada y registrada en auditoría.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleRevokeSeller = async (userId: string) => {
    if (!confirm('¿Quitar permisos de vendedor a este usuario?')) return

    try {
      const res = await revokeSellerAction(userId)
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u
            return { ...u, role: 'buyer', subscriptions: [{ ...u.subscriptions[0], is_active: false }] }
          })
        )
        alert('Permisos revocados y registrados en auditoría.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleToggleFreeMode = async () => {
    const newState = !freePublishingMode
    if (!confirm(`¿${newState ? 'Activar' : 'Desactivar'} el modo de publicación libre global?`)) return

    setFreePublishingMode(newState)
    try {
      const res = await toggleFreePublishingAction(newState)
      if (!res.success) throw new Error('Falló la acción')
    } catch (error: unknown) {
      const e = error as Error
      setFreePublishingMode(!newState)
      alert('Error al cambiar configuración: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleToggleRequireApproval = async () => {
    const newState = !requireApprovalMode
    if (!confirm(`¿${newState ? 'Activar' : 'Desactivar'} la aprobación obligatoria de publicaciones?`)) return

    setRequireApprovalMode(newState)
    try {
      const res = await toggleListingApprovalAction(newState)
      if (!res.success) throw new Error('Falló la acción')
    } catch (error: unknown) {
      const e = error as Error
      setRequireApprovalMode(!newState)
      alert('Error al cambiar configuración: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleApproveListing = async (listingId: string) => {
    if (!confirm('¿Aprobar esta publicación para hacerla pública?')) return
    try {
      const res = await approveListingAction(listingId)
      if (res.success) {
        setPendingListings((prev) => prev.filter((l) => l.id !== listingId))
        setStats((prev) => ({
          ...prev,
          listings: {
            ...prev.listings,
            active: prev.listings.active + 1,
            pending: Math.max(0, prev.listings.pending - 1),
          },
        }))
        alert('Publicación aprobada con éxito.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al aprobar: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleRejectListing = async (listingId: string) => {
    if (!confirm('¿Rechazar y eliminar esta publicación?')) return
    try {
      const res = await rejectListingAction(listingId)
      if (res.success) {
        setPendingListings((prev) => prev.filter((l) => l.id !== listingId))
        setStats((prev) => ({
          ...prev,
          listings: {
            ...prev.listings,
            pending: Math.max(0, prev.listings.pending - 1),
          },
        }))
        alert('Publicación rechazada y eliminada.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al rechazar: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm('¿Banear a este usuario? Se suspenderá su cuenta y se eliminarán todas sus publicaciones activas de inmediato.')) return
    try {
      const res = await banUserAction(userId)
      if (res.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)))
        alert('Usuario suspendido y publicaciones retiradas con éxito.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al suspender: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleUnbanUser = async (userId: string) => {
    if (!confirm('¿Reactivar la cuenta de este usuario?')) return
    try {
      const res = await unbanUserAction(userId)
      if (res.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)))
        alert('Cuenta de usuario reactivada con éxito.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al reactivar: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = confirm(
      `⚠️ ELIMINAR USUARIO PERMANENTEMENTE\n\n¿Estás seguro de que deseas eliminar a "${userName}"?\n\nEsto eliminará:\n• Su cuenta de acceso\n• Su perfil\n• Todas sus publicaciones\n• Sus suscripciones\n\nEsta acción NO SE PUEDE DESHACER.`
    )
    if (!confirmed) return
    try {
      await deleteUserAction(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      alert('Usuario eliminado permanentemente.')
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al eliminar: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleAssignModerator = async (userId: string) => {
    if (!confirm('¿Designar a este usuario como Moderador? Podrá eliminar publicaciones inapropiadas y gestionar reportes.')) return
    try {
      const res = await assignModeratorAction(userId)
      if (res.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: 'moderator' } : u)))
        alert('🛡️ Usuario designado como Moderador exitosamente.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleRevokeModerator = async (userId: string) => {
    if (!confirm('¿Quitar el rol de Moderador a este usuario? Volverá a ser comprador.')) return
    try {
      const res = await revokeModeratorAction(userId)
      if (res.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: 'buyer' } : u)))
        alert('Rol de Moderador retirado.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleApproveVerification = async (userId: string) => {
    if (!confirm('¿Aprobar la credencial y otorgar la insignia de Estudiante Verificado UTA?')) return
    setActionLoadingId(userId)
    try {
      const res = await reviewVerificationAction(userId, true)
      if (res.success) {
        setVerifications((prev) => prev.filter((v) => v.id !== userId))
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_verified: true, verification_status: 'approved' } : u))
        )
        alert('🎓 Estudiante verificado exitosamente.')
      } else {
        alert(res.error || 'Error al aprobar')
      }
    } catch (err: unknown) {
      const e = err as Error
      alert('Error: ' + (e?.message || 'Desconocido'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRejectVerification = async (userId: string) => {
    const reason = prompt('Motivo del rechazo:', 'La credencial digital no es legible o los datos no coinciden.')
    if (reason === null) return
    setActionLoadingId(userId)
    try {
      const res = await reviewVerificationAction(userId, false, reason)
      if (res.success) {
        setVerifications((prev) => prev.filter((v) => v.id !== userId))
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, is_verified: false, verification_status: 'rejected', verification_rejected_reason: reason }
              : u
          )
        )
        alert('Solicitud rechazada y notificada al estudiante.')
      } else {
        alert(res.error || 'Error al rechazar')
      }
    } catch (err: unknown) {
      const e = err as Error
      alert('Error: ' + (e?.message || 'Desconocido'))
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleToggleVerificationFeature = async () => {
    const nextState = !verificationFeatureEnabled
    try {
      const res = await setFeatureFlagAction('student_verification_enabled', nextState)
      if (res.success) {
        setVerificationFeatureEnabled(nextState)
        alert(`Función de Verificación Estudiantil ${nextState ? 'ACTIVADA' : 'DESACTIVADA'}.`)
      } else {
        alert(res.error || 'Error al actualizar configuración')
      }
    } catch (err: unknown) {
      const e = err as Error
      alert('Error: ' + (e?.message || 'Desconocido'))
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return users
    return users.filter((user) => {
      const nameMatch = user.full_name?.toLowerCase().includes(q)
      const emailMatch = user.email?.toLowerCase().includes(q)
      return nameMatch || emailMatch
    })
  }, [users, searchQuery])

  const handleDownloadExcel = async () => {
    await exportAdminReportToExcel(supabase, users, stats)
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <main
          style={{
            paddingTop: 64,
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
            }}
          />
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh', paddingBottom: '4rem' }}>
        <div className="page-container" style={{ paddingTop: '2.5rem' }}>
          <AdminHeader
            onDownloadExcel={handleDownloadExcel}
            onToggleFreeMode={handleToggleFreeMode}
            onToggleRequireApproval={handleToggleRequireApproval}
            freePublishingMode={freePublishingMode}
            requireApprovalMode={requireApprovalMode}
          />

          <AdminStatsGrid
            stats={stats}
            reportsCount={reports.length}
            verificationsCount={verifications.length}
            storageUsedMB={storageUsedMB}
            weeklyStats={weeklyStats}
            weeklyStatsError={weeklyStatsError}
          />

          {/* Tabs header */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: '1.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: 6,
              width: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {(['reports', 'users', 'approvals', 'verifications'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: tab === t ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                  color: tab === t ? 'white' : 'var(--text-secondary)',
                  boxShadow: tab === t ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                }}
              >
                {t === 'reports'
                  ? `Reportes (${reports.length})`
                  : t === 'users'
                  ? `Usuarios (${filteredUsers.length})`
                  : t === 'approvals'
                  ? `Aprobaciones (${pendingListings.length})`
                  : `🎓 Verificaciones (${verifications.length})`}
              </button>
            ))}
          </div>

          {tab === 'reports' && (
            <ReportsTab
              reports={reports}
              loading={loading}
              onDismiss={handleDismissReport}
              onWarnSeller={handleWarnSeller}
              onRemoveListing={handleRemoveListing}
            />
          )}

          {tab === 'users' && (
            <UsersTab
              users={filteredUsers}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isAdmin={isAdmin}
              onUnbanUser={handleUnbanUser}
              onBanUser={handleBanUser}
              onApproveSeller={handleApproveSeller}
              onRevokeSeller={handleRevokeSeller}
              onAssignModerator={handleAssignModerator}
              onRevokeModerator={handleRevokeModerator}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {tab === 'approvals' && (
            <ApprovalsTab
              pendingListings={pendingListings}
              loading={loading}
              onApprove={handleApproveListing}
              onReject={handleRejectListing}
            />
          )}

          {tab === 'verifications' && (
            <VerificationsTab
              verifications={verifications}
              loading={loading}
              verificationFeatureEnabled={verificationFeatureEnabled}
              isAdmin={isAdmin}
              actionLoadingId={actionLoadingId}
              onToggleFeature={handleToggleVerificationFeature}
              onApprove={handleApproveVerification}
              onReject={handleRejectVerification}
              onZoomImage={setZoomImage}
            />
          )}
        </div>

        <ZoomModal imageUrl={zoomImage} onClose={() => setZoomImage(null)} />
      </main>
    </>
  )
}
