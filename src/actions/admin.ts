'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Función auxiliar para inicializar Supabase Server
async function getAdminSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {} // Server Actions no deben setear cookies aquí normalmente
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('No autorizado. Se requiere rol admin.')

  return { supabase, user }
}

export async function approveSellerAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  // 1. Cambiar rol a seller
  await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId)

  // 2. Desactivar suscripciones anteriores
  await supabase.from('subscriptions').update({ is_active: false }).eq('user_id', userId)

  // 3. Insertar nueva suscripción de 30 días
  const endsAt = new Date()
  endsAt.setDate(endsAt.getDate() + 30) // +30 días

  await supabase.from('subscriptions').insert({
    user_id: userId,
    plan: 'paid',
    is_active: true,
    starts_at: new Date().toISOString(),
    ends_at: endsAt.toISOString()
  })

  // 4. Registrar en auditoría (requerido por regla global)
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'approve_seller_manual',
    target_id: userId,
    details: { duration_days: 30 }
  })

  return { success: true, endsAt: endsAt.toISOString() }
}

export async function revokeSellerAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  // 1. Cambiar rol a buyer
  await supabase.from('profiles').update({ role: 'buyer' }).eq('id', userId)

  // 2. Desactivar suscripción
  await supabase.from('subscriptions').update({ is_active: false }).eq('user_id', userId)

  // 3. Registrar en auditoría
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'revoke_seller_manual',
    target_id: userId
  })

  return { success: true }
}

export async function toggleFreePublishingAction(enabled: boolean) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('platform_settings').upsert({
    key: 'free_publishing_mode',
    value: enabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id
  })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'toggle_free_publishing',
    target_id: 'global',
    details: { enabled }
  })

  return { success: true }
}
