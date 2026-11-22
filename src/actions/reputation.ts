'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function bumpListingAction(listingId: string): Promise<{
  success: boolean
  error?: string
  bumped_at?: string
  next_available?: string
}> {
  try {
    if (!listingId || typeof listingId !== 'string') {
      return { success: false, error: 'Publicación inválida.' }
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return { success: false, error: 'Debes iniciar sesión para reactivar una publicación.' }
    }

    // Intentar primero con la función RPC de Supabase
    const { data: rpcData, error: rpcErr } = await supabase.rpc('bump_listing', {
      target_listing_id: listingId,
    })

    if (!rpcErr && rpcData) {
      if (rpcData.success) {
        revalidatePath('/')
        revalidatePath('/dashboard')
        return { success: true, bumped_at: rpcData.bumped_at }
      }
      return {
        success: false,
        error: rpcData.error,
        next_available: rpcData.next_available,
      }
    }

    // Respaldo server-side con service_role tras validar dueño, cuenta activa, verificación y cooldown de 24h
    const supabaseAdmin = createServiceClient()
    const { data: listing, error: listErr } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, bumped_at, created_at, status')
      .eq('id', listingId)
      .single()

    if (listErr || !listing || listing.status !== 'active') {
      return { success: false, error: 'Publicación no encontrada o no activa.' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'No tienes permisos para modificar esta publicación.' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_verified, is_active')
      .eq('id', user.id)
      .single()

    if (profile?.is_active === false) {
      return { success: false, error: 'Tu cuenta está suspendida.' }
    }

    if (!profile?.is_verified) {
      return { success: false, error: 'Debes verificar tu carnet estudiantil para usar la función de subir al inicio.' }
    }

    const lastBumpTime = new Date(listing.bumped_at || listing.created_at).getTime()
    const nowTime = Date.now()
    const twentyFourHoursMs = 24 * 60 * 60 * 1000

    if (nowTime - lastBumpTime < twentyFourHoursMs) {
      const nextAvailable = new Date(lastBumpTime + twentyFourHoursMs).toISOString()
      return {
        success: false,
        error: 'Debes esperar 24 horas entre cada reactivación.',
        next_available: nextAvailable,
      }
    }

    const nowIso = new Date().toISOString()
    const { error: updateErr } = await supabaseAdmin
      .from('listings')
      .update({
        bumped_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', listingId)
      .eq('seller_id', user.id)

    if (updateErr) {
      return { success: false, error: 'Error al actualizar la publicación.' }
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    return { success: true, bumped_at: nowIso }
  } catch (err) {
    console.error('Error en bumpListingAction:', err)
    return { success: false, error: 'Ocurrió un error inesperado al reactivar la publicación.' }
  }
}

export async function toggleUrgentAction(listingId: string): Promise<{
  success: boolean
  error?: string
  is_urgent?: boolean
}> {
  try {
    if (!listingId || typeof listingId !== 'string') {
      return { success: false, error: 'Publicación inválida.' }
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return { success: false, error: 'No autenticado.' }
    }

    const { data: listing, error: listErr } = await supabase
      .from('listings')
      .select('id, seller_id, status, is_urgent')
      .eq('id', listingId)
      .single()

    if (listErr || !listing) {
      return { success: false, error: 'Publicación no encontrada.' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'No tienes permiso para modificar esta publicación.' }
    }

    if (listing.status !== 'active') {
      return { success: false, error: 'Solo puedes destacar publicaciones activas.' }
    }

    const newUrgent = !listing.is_urgent

    const { error: updateErr } = await supabase
      .from('listings')
      .update({ is_urgent: newUrgent })
      .eq('id', listingId)
      .eq('seller_id', user.id)

    if (updateErr) {
      return { success: false, error: 'Error al actualizar etiqueta de oferta.' }
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    return { success: true, is_urgent: newUrgent }
  } catch (err) {
    console.error('Error en toggleUrgentAction:', err)
    return { success: false, error: 'Error interno al actualizar oferta.' }
  }
}
