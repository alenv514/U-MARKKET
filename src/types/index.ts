export type UserRole = 'buyer' | 'seller' | 'moderator' | 'admin'

export interface Profile {
  id: string
  full_name: string
  phone?: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  email?: string | null
  rating_avg?: number | null
  review_count?: number | null
  faculty: string | null
  semester: string | null
  is_verified?: boolean
  verification_status?: 'none' | 'pending' | 'approved' | 'rejected'
  credential_url?: string | null
  verification_rejected_reason?: string | null
  verified_at?: string | null
  verification_submitted_at?: string | null
  created_at: string
  updated_at: string
}

// Facultades y carreras de la UTA para registro de perfil
export const UTA_FACULTY_CAREERS: Record<string, string[]> = {
  'FISEI - Ing. en Sistemas, Electrónica e Industrial': [
    'Ingeniería de Software',
    'Tecnologías de la Información',
    'Telecomunicaciones',
    'Electrónica y Automatización',
    'Ingeniería Industrial',
    'Robótica e Inteligencia Artificial',
  ],
  'FICM - Ing. Civil y Mecánica': [
    'Ingeniería Civil',
    'Ingeniería Mecánica',
  ],
  'FCIAL - Ciencias e Ing. en Alimentos y Biotecnología': [
    'Alimentos',
    'Biotecnología',
    'Bioquímica y Farmacia',
  ],
  'Facultad de Ciencias Agropecuarias': [
    'Agronomía',
    'Medicina Veterinaria',
    'Agroindustria',
  ],
  'Facultad de Ciencias de la Salud': [
    'Medicina',
    'Enfermería',
    'Fisioterapia',
    'Laboratorio Clínico',
    'Nutrición y Dietética',
    'Terapia Ocupacional',
  ],
  'Facultad de Ciencias Administrativas': [
    'Administración de Empresas',
    'Marketing y Gestión de Negocios',
    'Gestión de Talento Humano',
    'Negocios Internacionales',
  ],
  'Facultad de Contabilidad y Auditoría': [
    'Contabilidad y Auditoría',
    'Finanzas',
    'Economía',
  ],
  'Facultad de Jurisprudencia y Ciencias Sociales': [
    'Derecho',
    'Trabajo Social',
    'Comunicación',
  ],
  'FCHE - Ciencias Humanas y de la Educación': [
    'Psicología Clínica',
    'Psicopedagogía',
    'Pedagogía de la Actividad Física y Deporte',
    'Educación Inicial',
    'Educación Básica',
    'Pedagogía de los Idiomas Nacionales y Extranjeros (Inglés)',
    'Pedagogía de las Ciencias Experimentales (Química y Biología)',
    'Pedagogía de las Ciencias Experimentales (Matemáticas y Física)',
    'Turismo',
  ],
  'FDA - Diseño y Arquitectura': [
    'Arquitectura',
    'Diseño Gráfico',
    'Diseño de Espacios y Ambientes',
    'Diseño de Productos',
  ],
}

export const SEMESTERS = [
  '1er semestre', '2do semestre', '3er semestre', '4to semestre',
  '5to semestre', '6to semestre', '7mo semestre', '8vo semestre',
  '9no semestre', '10mo semestre',
] as const

/** Infiere la facultad a partir del nombre o texto de la carrera del carnet UTA */
export function getFacultyFromCareer(careerName: string): string | null {
  if (!careerName) return null
  const normalized = careerName.trim().toLowerCase()
  for (const [faculty, careers] of Object.entries(UTA_FACULTY_CAREERS)) {
    for (const c of careers) {
      const cNorm = c.toLowerCase()
      if (normalized.includes(cNorm) || cNorm.includes(normalized)) {
        return faculty
      }
    }
  }
  return null
}

export interface Subscription {
  id: string
  user_id: string
  plan: 'free' | 'paid'
  starts_at: string
  ends_at: string | null
  is_active: boolean
  created_at: string
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  description: string | null
  price: number
  category: string
  image_url: string | null
  whatsapp_number: string | null
  status: 'active' | 'paused' | 'removed' | 'pending_approval'
  report_count: number
  views: number
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Report {
  id: string
  listing_id: string
  reporter_id: string
  reason: string
  status: 'pending' | 'reviewed' | 'dismissed'
  created_at: string
  listings?: Listing
}

export const CATEGORIES = [
  'Todos',
  'Tecnología',
  'Ropa y Accesorios',
  'Comida y Bebidas',
  'Libros y Apuntes',
  'Servicios',
  'Electrónica',
  'Deporte',
  'Arte y Manualidades',
  'Hogar',
  'Otros',
] as const

export type Category = typeof CATEGORIES[number]

export interface Chat {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
  listings?: Listing
  buyer?: Profile
  seller?: Profile
  messages?: Message[]
}

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: Profile
}
