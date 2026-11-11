import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminStats, UserWithSub } from '../types'

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

export async function exportAdminReportToExcel(
  supabase: SupabaseClient,
  users: UserWithSub[],
  stats: AdminStats
) {
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
  users.forEach((u) => {
    const f = u.faculty || 'Sin facultad'
    if (!facultyMap[f]) facultyMap[f] = { estudiantes: 0, publicaciones: 0 }
    facultyMap[f].estudiantes++
  })

  const reportListings = (listings as unknown as ListingReportRow[]) ?? []

  reportListings.forEach((l) => {
    const f = l.profiles?.faculty || 'Sin facultad'
    if (!facultyMap[f]) facultyMap[f] = { estudiantes: 0, publicaciones: 0 }
    if (l.status === 'active') facultyMap[f].publicaciones++
  })

  const facultyRows = [
    ['Facultad', 'Estudiantes', 'Publicaciones activas'],
    ...Object.entries(facultyMap).map(([f, v]) => [f, v.estudiantes, v.publicaciones]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(facultyRows), 'Por Facultad')

  // Hoja 3: Por semestre
  const semMap: Record<string, { estudiantes: number; publicaciones: number }> = {}
  users.forEach((u) => {
    const s = u.semester ? u.semester.split(' - ')[0] : 'Sin semestre'
    if (!semMap[s]) semMap[s] = { estudiantes: 0, publicaciones: 0 }
    semMap[s].estudiantes++
  })

  reportListings.forEach((l) => {
    const s = l.profiles?.semester ? l.profiles.semester.split(' - ')[0] : 'Sin semestre'
    if (!semMap[s]) semMap[s] = { estudiantes: 0, publicaciones: 0 }
    if (l.status === 'active') semMap[s].publicaciones++
  })

  const semRows = [
    ['Semestre', 'Estudiantes', 'Publicaciones activas'],
    ...Object.entries(semMap).map(([s, v]) => [s, v.estudiantes, v.publicaciones]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(semRows), 'Por Semestre')

  // Hoja 4: Top vendedores
  const sellerCount: Record<string, { nombre: string; facultad: string; semestre: string; publicaciones: number }> = {}
  reportListings.forEach((l) => {
    if (l.status !== 'active') return
    const id = l.seller_id
    if (!sellerCount[id]) {
      sellerCount[id] = {
        nombre: l.profiles?.full_name || id,
        facultad: l.profiles?.faculty || '-',
        semestre: l.profiles?.semester?.split(' - ')[0] || '-',
        publicaciones: 0,
      }
    }
    sellerCount[id].publicaciones++
  })

  const topSellers = Object.values(sellerCount)
    .sort((a, b) => b.publicaciones - a.publicaciones)
    .slice(0, 50)

  const topRows = [
    ['#', 'Nombre', 'Facultad', 'Semestre', 'Publicaciones activas'],
    ...topSellers.map((s, i) => [i + 1, s.nombre, s.facultad, s.semestre, s.publicaciones]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topRows), 'Top Vendedores')

  XLSX.writeFile(wb, `umarket-reporte-${new Date().toISOString().split('T')[0]}.xlsx`)
}
