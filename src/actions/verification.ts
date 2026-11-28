'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { R2_PUBLIC_URL } from '@/lib/r2'
import { doStudentNamesMatch, verifyUtaCarnetByQrUrl } from '@/lib/uta-carnet'

const ALLOWED_FEATURE_FLAGS = new Set(['student_verification_enabled'])

function isValidCredentialUrl(urlStr: string, userId: string): boolean {
  if (!R2_PUBLIC_URL) return false
  try {
    const expectedBase = new URL(R2_PUBLIC_URL)
    const parsed = new URL(urlStr)
    if (parsed.protocol !== 'https:' || parsed.origin !== expectedBase.origin) {
      return false
    }
    const basePath = expectedBase.pathname.replace(/\/$/, '')
    const expectedPrefix = `${basePath}/credentials/${userId}/`
    if (!parsed.pathname.startsWith(expectedPrefix) || parsed.pathname.includes('..')) {
      return false
    }
    if (parsed.search || parsed.hash) return false
    return /\.(jpg|jpeg|png|webp)$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

/**
 * El estudiante envía su credencial/carnet UTA para verificación
 */
export async function submitVerificationAction(credentialUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!credentialUrl || typeof credentialUrl !== 'string') {
      return { success: false, error: 'Se requiere la imagen de la credencial' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    if (!isValidCredentialUrl(credentialUrl.trim(), user.id)) {
      return { success: false, error: 'La URL de la credencial no es válida.' }
    }

    const supabaseAdmin = createServiceClient()

    // Verificar que el módulo de verificación esté habilitado
    const { data: flag } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'student_verification_enabled')
      .maybeSingle()

    if (!flag || flag.value !== true) {
      return { success: false, error: 'La verificación estudiantil no está habilitada actualmente.' }
    }

    // Verificar cuenta activa y no verificada previamente
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_active, is_verified')
      .eq('id', user.id)
      .single()

    if (!currentProfile || currentProfile.is_active === false) {
      return { success: false, error: 'Tu cuenta no está activa.' }
    }
    if (currentProfile.is_verified) {
      return { success: false, error: 'Tu cuenta ya está verificada.' }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        credential_url: credentialUrl.trim(),
        verification_status: 'pending',
        verification_rejected_reason: null,
        verification_submitted_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      return { success: false, error: 'No se pudo registrar la credencial.' }
    }

    return { success: true }
  } catch (err: unknown) {
    console.error('Error submitVerificationAction:', err)
    return { success: false, error: 'Error interno al enviar credencial' }
  }
}

/**
 * Verificación automática de estudiante autenticado mediante el QR oficial de la credencial UTA.
 */
export async function verifyStudentQrAction(qrUrl: string): Promise<{
  success: boolean
  officialName?: string
  academicPeriod?: string | null
  needManualReview?: boolean
  error?: string
}> {
  try {
    if (!qrUrl || typeof qrUrl !== 'string') {
      return { success: false, error: 'No se detectó la URL del código QR.' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const supabaseAdmin = createServiceClient()

    const { data: flag } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'student_verification_enabled')
      .maybeSingle()

    if (!flag || (flag.value !== true && flag.value !== 'true')) {
      return { success: false, error: 'La verificación estudiantil no está habilitada actualmente.' }
    }

    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_active, is_verified, full_name')
      .eq('id', user.id)
      .single()

    if (!currentProfile || currentProfile.is_active === false) {
      return { success: false, error: 'Tu cuenta no está activa.' }
    }
    if (currentProfile.is_verified) {
      return { success: false, error: 'Tu cuenta ya está verificada.' }
    }

    const result = await verifyUtaCarnetByQrUrl(qrUrl)
    if (!result.valid || !result.cedulaHash || !result.officialName) {
      return { success: false, error: result.error || 'Credencial UTA no válida.' }
    }

    const { data: duplicateOwner, error: lookupErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cedula_hash', result.cedulaHash)
      .neq('id', user.id)
      .maybeSingle()

    if (lookupErr) {
      console.error('Error comprobando duplicidad de cedula_hash:', lookupErr.message)
      return { success: false, error: 'No se pudo comprobar la unicidad de la cédula en la base de datos.' }
    }

    if (duplicateOwner?.id) {
      return {
        success: false,
        error: 'Esta cédula ya se encuentra verificada y vinculada a otra cuenta de U-Market.',
      }
    }

    if (!doStudentNamesMatch(currentProfile.full_name || '', result.officialName)) {
      return {
        success: false,
        needManualReview: true,
        error: 'El nombre registrado en tu perfil no coincide con el titular de esta credencial UTA. Puedes enviar la imagen para revisión manual.',
      }
    }

    const now = new Date().toISOString()
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: result.officialName,
        cedula_hash: result.cedulaHash,
        is_verified: true,
        verification_status: 'approved',
        verification_rejected_reason: null,
        verified_at: now,
        verification_submitted_at: now,
      })
      .eq('id', user.id)

    if (updateErr) {
      if (updateErr.code === '23505') {
        return {
          success: false,
          error: 'Esta cédula ya está vinculada a otra cuenta verificada de U-Market.',
        }
      }
      return { success: false, error: 'No se pudo completar la verificación de la credencial.' }
    }

    return {
      success: true,
      officialName: result.officialName,
      academicPeriod: result.academicPeriod ?? null,
    }
  } catch (err: unknown) {
    console.error('Error verifyStudentQrAction:', err)
    return { success: false, error: 'Error interno al verificar la credencial UTA.' }
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
    if (!targetUserId || typeof targetUserId !== 'string') {
      return { success: false, error: 'Usuario objetivo inválido' }
    }

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
    const cleanReason = reason?.trim().slice(0, 300) || null
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
          verification_rejected_reason: cleanReason || 'La credencial no es legible o no coincide con los datos del perfil.',
          verified_at: null,
        }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    // Registrar en admin_actions usando las columnas reales del esquema (action, target_id)
    const { error: auditErr } = await supabaseAdmin.from('admin_actions').insert({
      admin_id: user.id,
      action: approved ? 'approve_verification' : 'reject_verification',
      target_id: targetUserId,
      details: { reason: cleanReason, timestamp: now },
    })

    if (auditErr) {
      console.error('Error registrando auditoría de verificación:', auditErr.message)
    }

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
    if (!ALLOWED_FEATURE_FLAGS.has(key)) {
      return { enabled: false }
    }

    const supabaseAdmin = createServiceClient()
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error || !data) {
      return { enabled: false }
    }

    return { enabled: data.value === true || data.value === 'true' }
  } catch {
    return { enabled: false }
  }
}

/**
 * Actualizar feature flag (solo admin)
 */
export async function setFeatureFlagAction(key: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ALLOWED_FEATURE_FLAGS.has(key)) {
      return { success: false, error: 'Configuración no permitida' }
    }

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
        value: Boolean(enabled),
        updated_at: new Date().toISOString(),
      })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: unknown) {
    console.error('Error setFeatureFlagAction:', err)
    return { success: false, error: 'Error interno al guardar configuración' }
  }
}
