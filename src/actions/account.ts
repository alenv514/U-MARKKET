'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { purgeUserFiles } from '@/lib/storage-cleanup'

export async function deleteOwnAccountAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const supabaseAdmin = createServiceClient()

    // 1. Borrar archivos (avatares + imágenes) antes de eliminar el usuario
    await purgeUserFiles(user.id, supabaseAdmin)

    // 2. Eliminar el usuario de auth (ON DELETE CASCADE borra el resto en la BD)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (error) return { success: false, error: error.message }

    return { success: true }
  } catch (error) {
    console.error('Error al eliminar cuenta:', error)
    return { success: false, error: 'Error interno al eliminar la cuenta' }
  }
}