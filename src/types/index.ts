export type UserRole = 'buyer' | 'seller' | 'admin'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  email?: string | null
  rating_avg?: number | null
  review_count?: number | null
  created_at: string
  updated_at: string
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
