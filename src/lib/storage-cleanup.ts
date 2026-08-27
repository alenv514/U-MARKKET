import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { r2, R2_BUCKET } from '@/lib/r2'

/**
 * Elimina los archivos de un usuario en Supabase Storage (avatares) y en
 * Cloudflare R2 (imágenes de publicaciones). Debe llamarse antes de borrar el
 * usuario de auth, con un cliente con privilegios (service role).
 */
export async function purgeUserFiles(userId: string, supabaseAdmin: SupabaseClient): Promise<void> {
  // Avatares en Supabase Storage (prefijo = carpeta del usuario)
  try {
    const { data: files } = await supabaseAdmin.storage.from('avatars').list(userId)
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`)
    if (paths.length > 0) {
      await supabaseAdmin.storage.from('avatars').remove(paths)
    }
  } catch (error) {
    console.warn('Error al purgar avatares:', error)
  }

  // Imágenes de publicaciones en Cloudflare R2 (prefijo listings/{userId}/)
  try {
    const { Contents } = await r2.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: `listings/${userId}/` })
    )
    const objects = (Contents ?? [])
      .map((obj) => ({ Key: obj.Key }))
      .filter((obj): obj is { Key: string } => Boolean(obj.Key))

    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: objects } })
      )
    }
  } catch (error) {
    console.warn('Error al purgar imágenes de R2:', error)
  }
}