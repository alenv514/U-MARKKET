'use client'

import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import type { AdminStats, WeeklyStatItem } from '../types'

interface AdminStatsGridProps {
  stats: AdminStats
  reportsCount: number
  verificationsCount: number
  storageUsedMB: number | null
  weeklyStats: WeeklyStatItem[]
  weeklyStatsError: string | null
}

export default function AdminStatsGrid({
  stats,
  reportsCount,
  verificationsCount,
  storageUsedMB,
  weeklyStats,
  weeklyStatsError,
}: AdminStatsGridProps) {
  return (
    <>
      <div
        className="animate-fade-in-up delay-100"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#3b82f6' }}>{stats.listings.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publicaciones Totales</div>
          <div style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#10b981' }}>{stats.listings.active} activas</span> •{' '}
            <span style={{ color: '#f59e0b' }}>{stats.listings.paused} pausadas</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#00345e' }}>{stats.users.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usuarios Registrados</div>
          <div style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#004b87' }}>{stats.users.sellers} vendedores</span> •{' '}
            <span>{stats.users.buyers} compradores</span> •{' '}
            <span style={{ color: '#ef4444' }}>{stats.users.admins} admins</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981' }}>{stats.activeSubs}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Suscripciones Activas</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444' }}>{reportsCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reportes Pendientes</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f59e0b' }}>{stats.listings.pending}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Publicaciones por Aprobar</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.5rem', cursor: 'default' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#00345e' }}>{verificationsCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carnets por Verificar</div>
        </div>

        {/* Storage indicator */}
        <div
          className="glass-card"
          style={{
            padding: '1rem 1.5rem',
            cursor: 'default',
            borderColor:
              storageUsedMB !== null && storageUsedMB > 800
                ? 'rgba(239,68,68,0.4)'
                : storageUsedMB !== null && storageUsedMB > 600
                ? 'rgba(245,158,11,0.4)'
                : undefined,
          }}
        >
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color:
                storageUsedMB !== null && storageUsedMB > 800
                  ? '#ef4444'
                  : storageUsedMB !== null && storageUsedMB > 600
                  ? '#f59e0b'
                  : '#06b6d4',
            }}
          >
            {storageUsedMB !== null ? `${storageUsedMB} MB` : '...'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Almacenamiento Usado</div>
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  width: storageUsedMB !== null ? `${Math.min((storageUsedMB / 1024) * 100, 100)}%` : '0%',
                  background:
                    storageUsedMB !== null && storageUsedMB > 800
                      ? '#ef4444'
                      : storageUsedMB !== null && storageUsedMB > 600
                      ? '#f59e0b'
                      : '#06b6d4',
                  transition: 'width 0.5s ease',
                }}
              />
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
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</span>
              <strong>Falta la función en la base de datos</strong>
              <p style={{ fontSize: '0.85rem', maxWidth: 400, marginTop: '0.5rem' }}>
                Asegúrate de ejecutar la consulta SQL de `get_weekly_stats` en el SQL Editor de Supabase.<br />
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Error: {weeklyStatsError}</span>
              </p>
            </div>
          ) : weeklyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyStats} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="formattedDay" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    color: '#0a192f',
                    boxShadow: '0 8px 32px rgba(10,37,64,0.15)',
                  }}
                  itemStyle={{ color: '#0a192f', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Legend wrapperStyle={{ paddingTop: 20 }} />
                <Line
                  type="monotone"
                  name="Nuevas Publicaciones"
                  dataKey="new_listings"
                  stroke="#00345e"
                  strokeWidth={4}
                  dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#00345e' }}
                />
                <Line
                  type="monotone"
                  name="Nuevos Usuarios"
                  dataKey="new_users"
                  stroke="#059669"
                  strokeWidth={4}
                  dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#059669' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              Cargando estadísticas...
            </div>
          )}
        </div>
      </div>
    </>
  )
}
