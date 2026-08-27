'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import type { Report, Profile } from '@/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx'
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
  getUsersForAdminAction
} from '@/actions/admin'
import { reviewVerificationAction, getFeatureFlagAction, setFeatureFlagAction } from '@/actions/verification'
import VerifiedBadge from '@/components/VerifiedBadge'

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

interface PendingListing {
  id: string
  title: string
  price: number
  category: string
  description: string | null
  image_url: string | null
  status: string
  created_at: string
  seller_id: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface WeeklyStatItem {
  day: string
  formattedDay: string
  views?: number
  [key: string]: unknown
}

export default function AdminPage() {
  const [reports, setReports] = useState<ReportWithListing[]>([])
  const [users, setUsers] = useState<UserWithSub[]>([])
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([])
  const [verifications, setVerifications] = useState<Profile[]>([])
  const [verificationFeatureEnabled, setVerificationFeatureEnabled] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    listings: { total: 0, active: 0, paused: 0, pending: 0 },
    users: { total: 0, sellers: 0, buyers: 0, admins: 0 },
    activeSubs: 0
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

    const [reportsRes, usersRes, settingsRes, approvalSettingsRes, pendingListingsRes, weeklyStatsRes, verificationsRes, verificationFlagRes] = await Promise.all([
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
      getFeatureFlagAction('student_verification_enabled')
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
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    ])

    setStats({
      listings: { total: totalListings || 0, active: activeListings || 0, paused: pausedListings || 0, pending: pendingListingsCount || 0 },
      users: { total: totalUsers || 0, sellers: sellerUsers || 0, buyers: buyerUsers || 0, admins: adminUsers || 0 },
      activeSubs: activeSubs || 0
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
    setUsers((usersRes.users as UserWithSub[]) ?? [])
    setPendingListings((pendingListingsRes.data as PendingListing[]) ?? [])

    // Calcular espacio usado contando imágenes en storage
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

  const handleRemoveListing = async (listingId: string, reportId: string) => {
    if (!confirm('¿Eliminar esta publicación?')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action: 'remove_listing_report',
      target_id: listingId,
      details: { reportId }
    })
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
        setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u
          return { ...u, role: 'buyer', subscriptions: [{ ...u.subscriptions[0], is_active: false }] }
        }))
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
      setFreePublishingMode(!newState) // Revert on error
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
      setRequireApprovalMode(!newState) // Revert on error
      alert('Error al cambiar configuración: ' + (e?.message || 'Error desconocido'))
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
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
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
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u))
        alert('Cuenta de usuario reactivada con éxito.')
      }
    } catch (error: unknown) {
      const e = error as Error
      alert('Error al reactivar: ' + (e?.message || 'Error desconocido'))
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = confirm(`⚠️ ELIMINAR USUARIO PERMANENTEMENTE\n\n¿Estás seguro de que deseas eliminar a "${userName}"?\n\nEsto eliminará:\n• Su cuenta de acceso\n• Su perfil\n• Todas sus publicaciones\n• Sus suscripciones\n\nEsta acción NO SE PUEDE DESHACER.`)
    if (!confirmed) return
    try {
      await deleteUserAction(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
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
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'moderator' } : u))
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
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'buyer' } : u))
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
        setVerifications(prev => prev.filter(v => v.id !== userId))
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: true, verification_status: 'approved' } : u))
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
        setVerifications(prev => prev.filter(v => v.id !== userId))
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: false, verification_status: 'rejected', verification_rejected_reason: reason } : u))
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

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    const nameMatch = user.full_name?.toLowerCase().includes(q)
    const emailMatch = user.email?.toLowerCase().includes(q)
    return nameMatch || emailMatch
  })

  const handleDownloadExcel = async () => {
    // Obtener listings con seller info para el reporte
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, status, seller_id, profiles(full_name, faculty, semester)')

    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen general
    const resumen = [
      ['Reporte U-Market', new Date().toLocaleDateString('es-EC')],
      [],
      ['Métrica', 'Valor'],
      ['Total estudiantes', stats.users.total],
      ['Vendedores', stats.users.sellers],
      ['Compradores', stats.users.buyers],
      ['Publicaciones activas', stats.listings.active],
      ['Publicaciones pendientes', stats.listings.pending],
      ['Suscripciones activas', stats.activeSubs],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen')

    // Hoja 2: Por facultad
    const facultyMap: Record<string, { estudiantes: number; publicaciones: number }> = {}
    users.forEach(u => {
      const f = u.faculty || 'Sin facultad'
      if (!facultyMap[f]) facultyMap[f] = { estudiantes: 0, publicaciones: 0 }
      facultyMap[f].estudiantes++
    })
    interface ListingReportRow {
      id: string
      title: string
      status: string
      seller_id: string
      profiles?: {
        full_name?: string | null
        faculty?: string | null
        semester?: string | null
      } | null
    }

    const reportListings = (listings as unknown as ListingReportRow[]) ?? []

    reportListings.forEach((l) => {
      const f = l.profiles?.faculty || 'Sin facultad'
      if (!facultyMap[f]) facultyMap[f] = { estudiantes: 0, publicaciones: 0 }
      if (l.status === 'active') facultyMap[f].publicaciones++
    })
    const facultyRows = [['Facultad', 'Estudiantes', 'Publicaciones activas'],
      ...Object.entries(facultyMap).map(([f, v]) => [f, v.estudiantes, v.publicaciones])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(facultyRows), 'Por Facultad')

    // Hoja 3: Por semestre
    const semMap: Record<string, { estudiantes: number; publicaciones: number }> = {}
    users.forEach(u => {
      const s = u.semester ? u.semester.split(' - ')[0] : 'Sin semestre'
      if (!semMap[s]) semMap[s] = { estudiantes: 0, publicaciones: 0 }
      semMap[s].estudiantes++
    })
    reportListings.forEach((l) => {
      const s = l.profiles?.semester ? l.profiles.semester.split(' - ')[0] : 'Sin semestre'
      if (!semMap[s]) semMap[s] = { estudiantes: 0, publicaciones: 0 }
      if (l.status === 'active') semMap[s].publicaciones++
    })
    const semRows = [['Semestre', 'Estudiantes', 'Publicaciones activas'],
      ...Object.entries(semMap).map(([s, v]) => [s, v.estudiantes, v.publicaciones])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(semRows), 'Por Semestre')

    // Hoja 4: Top vendedores (usuarios con más publicaciones activas)
    const sellerCount: Record<string, { nombre: string; facultad: string; semestre: string; publicaciones: number }> = {}
    reportListings.forEach((l) => {
      if (l.status !== 'active') return
      const id = l.seller_id
      if (!sellerCount[id]) sellerCount[id] = {
        nombre: l.profiles?.full_name || id,
        facultad: l.profiles?.faculty || '-',
        semestre: l.profiles?.semester?.split(' - ')[0] || '-',
        publicaciones: 0,
      }
      sellerCount[id].publicaciones++
    })
    const topSellers = Object.values(sellerCount)
      .sort((a, b) => b.publicaciones - a.publicaciones)
      .slice(0, 50)
    const topRows = [['#', 'Nombre', 'Facultad', 'Semestre', 'Publicaciones activas'],
      ...topSellers.map((s, i) => [i + 1, s.nombre, s.facultad, s.semestre, s.publicaciones])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topRows), 'Top Vendedores')

    XLSX.writeFile(wb, `umarket-reporte-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

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
                onClick={handleDownloadExcel}
                style={{ fontWeight: 700, padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                📥 Descargar Reporte Excel
              </button>
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
                <h3 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>Modo &quot;Publicación Libre&quot; Activado</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Todos los usuarios pueden publicar sin suscripción.</p>
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

            <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6366f1' }}>{verifications.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carnets por Verificar</div>
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
          <div style={{
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
          }}>
            {(['reports', 'users', 'approvals', 'verifications'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
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
              }}>
                {t === 'reports' ? `Reportes (${reports.length})` : t === 'users' ? `Usuarios (${filteredUsers.length})` : t === 'approvals' ? `Aprobaciones (${pendingListings.length})` : `🎓 Verificaciones (${verifications.length})`}
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
                    <div key={report.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                          {report.listings?.title || 'Publicación eliminada'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                          Razón: <strong style={{ color: 'var(--text-primary)' }}>{report.reason}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(report.created_at).toLocaleDateString('es-EC')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem' }}>
                        <button onClick={() => handleDismissReport(report.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', flex: '1 1 auto' }}>
                          Ignorar
                        </button>
                        {report.listings?.seller_id && (
                          <button onClick={() => handleWarnSeller(report.id, report.listings.seller_id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#f59e0b', flex: '1 1 auto' }}>
                            Advertir Vendedor
                          </button>
                        )}
                        <button onClick={() => handleRemoveListing(report.listings?.id, report.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.78rem', flex: '1 1 auto' }}>
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
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
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
                  placeholder="Buscar por correo (@uta.edu.ec) o nombre..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.75rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No se encontraron usuarios que coincidan con &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredUsers.map(user => {
                  const sub = user.subscriptions?.find(s => s.is_active) || user.subscriptions?.[0]
                  const subActive = sub?.is_active && (!sub.ends_at || new Date(sub.ends_at) > new Date())
                  return (
                    <div key={user.id} className="glass-card" style={{
                      padding: '1.1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      borderRadius: 16,
                    }}>
                      {/* Cabecera del usuario (Avatar + Info + Badges) */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', fontWeight: 800, color: 'white', flexShrink: 0,
                          marginTop: 2,
                        }}>
                          {user.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{user.full_name || 'Sin nombre'}</span>
                            {user.is_verified && <VerifiedBadge size="sm" showText />}
                          </div>
                          {user.email && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, wordBreak: 'break-all' }}>
                              📧 {user.email}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {user.is_active === false && (
                              <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>
                                🚫 Suspendido
                              </span>
                            )}
                            <span className={`badge ${
                              user.role === 'admin' ? 'badge-red' :
                              user.role === 'moderator' ? 'badge-amber' :
                              user.role === 'seller' ? 'badge-indigo' : 'badge-amber'
                            }`} style={{ fontSize: '0.72rem' }}>
                              {user.role === 'moderator' ? '🛡️ moderador' : user.role}
                            </span>
                            <span className={`badge ${subActive ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.72rem' }}>
                              {subActive ? `✅ ${sub?.plan ?? 'free'}` : '⏱ sin sub'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Barra de Acciones del Usuario (Fluida y responsive) */}
                      {isAdmin && (
                        <div style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          alignItems: 'center',
                        }}>
                          {user.role !== 'admin' && (
                            <>
                              {user.is_active === false ? (
                                <button
                                  onClick={() => handleUnbanUser(user.id)}
                                  className="btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981', flex: '1 1 auto', minHeight: 32 }}
                                >
                                  🟢 Activar Cuenta
                                </button>
                              ) : (
                                <>
                                  {user.role === 'moderator' ? (
                                    <button
                                      onClick={() => handleRevokeModerator(user.id)}
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', flex: '1 1 auto', minHeight: 32 }}
                                      title="Quitar rol de moderador"
                                    >
                                      ↩️ Quitar Moderador
                                    </button>
                                  ) : (
                                    <>
                                      {user.role !== 'seller' ? (
                                        <button
                                          onClick={() => handleApproveSeller(user.id)}
                                          className="btn-primary"
                                          style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981', flex: '1 1 auto', minHeight: 32 }}
                                        >
                                          ✅ Vendedor (30d)
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleRevokeSeller(user.id)}
                                          className="btn-danger"
                                          style={{ padding: '6px 12px', fontSize: '0.75rem', flex: '1 1 auto', minHeight: 32 }}
                                        >
                                          ❌ Revocar Vendedor
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleAssignModerator(user.id)}
                                        className="btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', flex: '1 1 auto', minHeight: 32 }}
                                        title="Designar como Moderador"
                                      >
                                        🛡️ Moderador
                                      </button>
                                      <button
                                        onClick={() => handleBanUser(user.id)}
                                        className="btn-danger"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#ef4444', flex: '1 1 auto', minHeight: 32 }}
                                      >
                                        🚫 Banear
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteUser(user.id, user.full_name || user.email || 'Usuario')}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '0.8rem',
                                  background: 'rgba(127,29,29,0.4)',
                                  border: '1px solid rgba(239,68,68,0.35)',
                                  borderRadius: 8,
                                  color: '#fca5a5',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  minHeight: 32,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Eliminar usuario permanentemente"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      )}
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

          {/* Verifications tab */}
          {tab === 'verifications' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Banner de Control del Feature Flag (Interruptor para el lanzamiento a las 2 semanas) */}
              <div className="glass-card" style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                border: verificationFeatureEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                background: verificationFeatureEnabled ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '1.2rem' }}>{verificationFeatureEnabled ? '🟢' : '⏸️'}</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Módulo de Verificación para Estudiantes: {verificationFeatureEnabled ? 'ACTIVADO' : 'DESACTIVADO (Oculto)'}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {verificationFeatureEnabled
                      ? 'Los estudiantes pueden ver la opción en su perfil y subir su credencial UTA.'
                      : 'La función está oculta para los estudiantes hasta que decidas habilitarla para el lanzamiento oficial.'}
                  </p>
                </div>

                {isAdmin && (
                  <button
                    onClick={handleToggleVerificationFeature}
                    className={verificationFeatureEnabled ? 'btn-danger' : 'btn-primary'}
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700 }}
                  >
                    {verificationFeatureEnabled ? 'Desactivar Función' : '🚀 Activar Función (Lanzamiento)'}
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
                </div>
              ) : verifications.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎓</div>
                  <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sin solicitudes de verificación pendientes</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Todas las credenciales han sido revisadas.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {verifications.map(user => (
                    <div key={user.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                      {/* Credential Image Thumbnail */}
                      {user.credential_url ? (
                        <div
                          onClick={() => setZoomImage(user.credential_url || null)}
                          style={{
                            width: 70,
                            height: 90,
                            borderRadius: 10,
                            overflow: 'hidden',
                            cursor: 'zoom-in',
                            flexShrink: 0,
                            border: '2px solid rgba(99,102,241,0.4)',
                            background: '#0d1117',
                            position: 'relative',
                          }}
                          title="Click para ampliar imagen del carnet"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={user.credential_url}
                            alt="Carnet UTA"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.75)', color: '#93c5fd',
                            fontSize: '0.65rem', textAlign: 'center', padding: '2px 0'
                          }}>
                            🔍 Ver
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          width: 70, height: 90, borderRadius: 10,
                          background: 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.5rem', flexShrink: 0,
                        }}>
                          🪪
                        </div>
                      )}

                      {/* Info del Alumno */}
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {user.full_name || 'Estudiante UTA'}
                          </span>
                          <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>Pendiente de Revisión</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#a5b4fc', marginBottom: 2 }}>
                          {user.faculty || 'Sin facultad'} {user.semester ? `· ${user.semester}` : ''}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Enviado:{' '}
                          {user.verification_submitted_at
                            ? new Date(user.verification_submitted_at).toLocaleString('es-EC')
                            : 'Recientemente'}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        {user.credential_url && (
                          <button
                            onClick={() => setZoomImage(user.credential_url || null)}
                            className="btn-secondary"
                            style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                          >
                            🔍 Ver Carnet
                          </button>
                        )}
                        <button
                          onClick={() => handleApproveVerification(user.id)}
                          disabled={actionLoadingId === user.id}
                          className="btn-primary"
                          style={{ padding: '7px 14px', fontSize: '0.8rem', background: '#10b981' }}
                        >
                          {actionLoadingId === user.id ? 'Aprobando...' : '✅ Aprobar Verificación'}
                        </button>
                        <button
                          onClick={() => handleRejectVerification(user.id)}
                          disabled={actionLoadingId === user.id}
                          className="btn-danger"
                          style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                        >
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

        {/* Modal de Zoom de Credencial */}
        {zoomImage && (
          <div
            onClick={() => setZoomImage(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              cursor: 'zoom-out',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                background: '#0d1117',
                borderRadius: 16,
                padding: '1rem',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomImage}
                alt="Carnet ampliado"
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
              <button
                onClick={() => setZoomImage(null)}
                className="btn-secondary"
                style={{ marginTop: '0.75rem', padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cerrar vista previa ✕
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
