import type { Profile, ReputationInfo, ReputationTier, AchievementBadge } from '@/types'

export interface ReputationStats {
  activeListings?: number
  bookListings?: number
}

export function computeReputation(
  profile?: Partial<Profile> | null,
  stats?: ReputationStats
): ReputationInfo {
  const isVerified = Boolean(profile?.is_verified)
  const rating = Number(profile?.rating_avg || 0)
  const reviews = Number(profile?.review_count || 0)
  const activeListings = Number(stats?.activeListings || 0)
  const bookListings = Number(stats?.bookListings || 0)

  let level: ReputationTier = 1
  let levelName = 'Estudiante UTA'
  let badgeLabel = 'Estudiante 🎓'
  let badgeColor = '#64748b'
  let progressPercent = 25
  let nextLevelName: string | null = 'Estudiante Verificado 🛡️'

  if (isVerified) {
    level = 2
    levelName = 'Estudiante Verificado'
    badgeLabel = 'Verificado 🛡️'
    badgeColor = '#00345e'
    progressPercent = 50
    nextLevelName = 'Vendedor Confiable ⚡'
  }

  if (isVerified && reviews >= 2 && rating >= 4.5) {
    level = 3
    levelName = 'Vendedor Confiable'
    badgeLabel = 'Confiable ⚡'
    badgeColor = '#059669'
    progressPercent = 75
    nextLevelName = 'Vendedor Top UTA 🏆'
  }

  if (isVerified && reviews >= 5 && rating >= 4.8) {
    level = 4
    levelName = 'Vendedor Top UTA'
    badgeLabel = 'Top UTA 🏆'
    badgeColor = '#d97706'
    progressPercent = 100
    nextLevelName = null
  }

  const badges: AchievementBadge[] = [
    {
      id: 'verified',
      icon: '🎓',
      title: 'Identidad UTA',
      description: 'Carnet estudiantil validado por administración.',
      unlocked: isVerified,
    },
    {
      id: 'five_stars',
      icon: '⭐',
      title: 'Cinco Estrellas',
      description: 'Calificación impecable en tratos universitarios.',
      unlocked: reviews > 0 && rating >= 4.8,
    },
    {
      id: 'frequent',
      icon: '⚡',
      title: 'Vendedor Frecuente',
      description: 'Al menos 3 tratos completados con buenas opiniones.',
      unlocked: reviews >= 3,
    },
    {
      id: 'books',
      icon: '📚',
      title: 'Biblioteca UTA',
      description: 'Aporte con libros, copias o apuntes de materias.',
      unlocked: bookListings > 0,
    },
    {
      id: 'active',
      icon: '📦',
      title: 'Emprendedor Activo',
      description: '3 o más publicaciones activas en el campus.',
      unlocked: activeListings >= 3,
    },
  ]

  return {
    level,
    levelName,
    badgeLabel,
    badgeColor,
    badges,
    canBump: isVerified,
    progressPercent,
    nextLevelName,
  }
}
