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

// Helper que acepta admin O moderador (para acciones de moderación compartidas)
async function getModSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
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

  if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
    throw new Error('No autorizado. Se requiere rol admin o moderador.')
  }

  return { supabase, user, role: profile.role as string }
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

export async function toggleListingApprovalAction(enabled: boolean) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('platform_settings').upsert({
    key: 'listings_require_approval',
    value: enabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id
  })

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'toggle_listings_require_approval',
    target_id: 'global',
    details: { enabled }
  })

  return { success: true }
}

export async function approveListingAction(listingId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('listings').update({ status: 'active' }).eq('id', listingId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'approve_listing_manual',
    target_id: listingId
  })

  return { success: true }
}

export async function rejectListingAction(listingId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'reject_listing_manual',
    target_id: listingId
  })

  return { success: true }
}

export async function banUserAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('profiles').update({ is_active: false }).eq('id', userId)
  await supabase.from('listings').update({ status: 'removed' }).eq('seller_id', userId).eq('status', 'active')

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'ban_user_manual',
    target_id: userId
  })

  return { success: true }
}

export async function unbanUserAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('profiles').update({ is_active: true }).eq('id', userId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'unban_user_manual',
    target_id: userId
  })

  return { success: true }
}

export async function deleteUserAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  // Registrar auditoría antes de borrar
  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'delete_user',
    target_id: userId
  })

  // Eliminar publicaciones y datos relacionados
  await supabase.from('listings').delete().eq('seller_id', userId)
  await supabase.from('subscriptions').delete().eq('user_id', userId)
  await supabase.from('reports').delete().eq('reporter_id', userId)

  // Eliminar perfil
  await supabase.from('profiles').delete().eq('id', userId)

  // Eliminar usuario de Supabase Auth usando service role key
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  return { success: true }
}

// ── Moderadores ──

export async function assignModeratorAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('profiles').update({ role: 'moderator' }).eq('id', userId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'assign_moderator',
    target_id: userId
  })

  return { success: true }
}

export async function revokeModeratorAction(userId: string) {
  const { supabase, user } = await getAdminSupabase()

  await supabase.from('profiles').update({ role: 'buyer' }).eq('id', userId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'revoke_moderator',
    target_id: userId
  })

  return { success: true }
}

// Usable por admin y moderador
export async function deleteListingAction(listingId: string, reason: string) {
  const { supabase, user, role } = await getModSupabase()

  await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId)

  await supabase.from('admin_actions').insert({
    admin_id: user.id,
    action: 'delete_listing_moderation',
    target_id: listingId,
    details: { reason, by_role: role }
  })

  return { success: true }
}
