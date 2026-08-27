'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * El estudiante envía su credencial/carnet UTA para verificación
 */
export async function submitVerificationAction(credentialUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!credentialUrl) {
      return { success: false, error: 'Se requiere la imagen de la credencial' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const supabaseAdmin = createServiceClient()

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        credential_url: credentialUrl,
        verification_status: 'pending',
        verification_rejected_reason: null,
        verification_submitted_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    return { success: true }
  } catch (err: unknown) {
    console.error('Error submitVerificationAction:', err)
    return { success: false, error: 'Error interno al enviar credencial' }
  }
}

/**
 * Admin o Moderador aprueba o rechaza una verificación
 */
export async function reviewVerificationAction(
  targetUserId: string,
  approved: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const supabaseAdmin = createServiceClient()

    // Verificar rol de admin o moderador
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'moderator')) {
      return { success: false, error: 'No tienes permisos de moderación o administración' }
    }

    const now = new Date().toISOString()
    const updateData = approved
      ? {
          is_verified: true,
          verification_status: 'approved',
          verification_rejected_reason: null,
          verified_at: now,
        }
      : {
          is_verified: false,
          verification_status: 'rejected',
          verification_rejected_reason: reason?.trim() || 'La credencial no es legible o no coincide con los datos del perfil.',
          verified_at: null,
        }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    // Registrar en admin_actions para auditoría
    await supabaseAdmin.from('admin_actions').insert({
      admin_id: user.id,
      action_type: approved ? 'approve_verification' : 'reject_verification',
      target_user_id: targetUserId,
      details: { reason: reason || null, timestamp: now },
    })

    return { success: true }
  } catch (err: unknown) {
    console.error('Error reviewVerificationAction:', err)
    return { success: false, error: 'Error interno al revisar verificación' }
  }
}

/**
 * Obtener estado de feature flag (ej: student_verification_enabled)
 */
export async function getFeatureFlagAction(key: string): Promise<{ enabled: boolean }> {
  try {
    const supabaseAdmin = createServiceClient()
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error || !data) {
      return { enabled: false }
    }

    return { enabled: Boolean(data.value) }
  } catch {
    return { enabled: false }
  }
}

/**
 * Actualizar feature flag (solo admin)
 */
export async function setFeatureFlagAction(key: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const supabaseAdmin = createServiceClient()

    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return { success: false, error: 'Solo el administrador puede modificar configuraciones globales' }
    }

    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key,
        value: enabled,
        updated_at: new Date().toISOString(),
      })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: unknown) {
    console.error('Error setFeatureFlagAction:', err)
    return { success: false, error: 'Error interno al guardar configuración' }
  }
}
