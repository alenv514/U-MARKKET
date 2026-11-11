import type { Report, Profile } from '@/types'

export interface ReportWithListing extends Omit<Report, 'listings'> {
  listings: {
    id: string
    title: string
    seller_id: string
    status: string
  }
}

export interface UserWithSub extends Profile {
  subscriptions: Array<{ plan: string; ends_at: string | null; is_active: boolean }>
}

export interface PendingListing {
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

export interface WeeklyStatItem {
  day: string
  formattedDay: string
  views?: number
  [key: string]: unknown
}

export interface AdminStats {
  listings: { total: number; active: number; paused: number; pending: number }
  users: { total: number; sellers: number; buyers: number; admins: number }
  activeSubs: number
}
