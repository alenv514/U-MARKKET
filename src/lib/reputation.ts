import type { Profile, ReputationInfo, ReputationTier, AchievementBadge } from '@/types'
import type { IconName } from '@/components/Icon'

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
  let badgeLabel = 'Estudiante'
  let badgeIcon: IconName = 'graduation'
  let badgeColor = '#334155'
  let progressPercent = 25
  let nextLevelName: string | null = 'Estudiante Verificado'
  let nextLevelIcon: IconName | null = 'shield'

  if (isVerified) {
    level = 2
    levelName = 'Estudiante Verificado'
    badgeLabel = 'Verificado'
    badgeIcon = 'shield'
    badgeColor = '#004b87'
    progressPercent = 50
    nextLevelName = 'Vendedor Confiable'
    nextLevelIcon = 'bolt'
  }

  if (isVerified && reviews >= 2 && rating >= 4.5) {
    level = 3
    levelName = 'Vendedor Confiable'
    badgeLabel = 'Confiable'
    badgeIcon = 'bolt'
    badgeColor = '#00345e'
    progressPercent = 75
    nextLevelName = 'Vendedor Top UTA'
    nextLevelIcon = 'trophy'
  }

  if (isVerified && reviews >= 5 && rating >= 4.8) {
    level = 4
    levelName = 'Vendedor Top UTA'
    badgeLabel = 'Top UTA'
    badgeIcon = 'trophy'
    badgeColor = '#0a192f'
    progressPercent = 100
    nextLevelName = null
    nextLevelIcon = null
  }

  const badges: AchievementBadge[] = [
    {
      id: 'verified',
      icon: 'graduation',
      title: 'Identidad UTA',
      description: 'Carnet estudiantil validado por administración.',
      unlocked: isVerified,
    },
    {
      id: 'five_stars',
      icon: 'star',
      title: 'Cinco Estrellas',
      description: 'Calificación impecable en tratos universitarios.',
      unlocked: reviews > 0 && rating >= 4.8,
    },
    {
      id: 'frequent',
      icon: 'bolt',
      title: 'Vendedor Frecuente',
      description: 'Al menos 3 tratos completados con buenas opiniones.',
      unlocked: reviews >= 3,
    },
    {
      id: 'books',
      icon: 'book',
      title: 'Biblioteca UTA',
      description: 'Aporte con libros, copias o apuntes de materias.',
      unlocked: bookListings > 0,
    },
    {
      id: 'active',
      icon: 'package',
      title: 'Emprendedor Activo',
      description: '3 o más publicaciones activas en el campus.',
      unlocked: activeListings >= 3,
    },
  ]

  return {
    level,
    levelName,
    badgeLabel,
    badgeIcon,
    badgeColor,
    badges,
    canBump: isVerified,
    progressPercent,
    nextLevelName,
    nextLevelIcon,
  }
}
