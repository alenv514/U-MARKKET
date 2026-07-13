'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function submitReviewAction(revieweeId: string, rating: number, comment: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in server actions
            }
          },
        },
      }
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
      return { success: false, error: 'Debes iniciar sesión para calificar.' }
    }

    if (authData.user.id === revieweeId) {
      return { success: false, error: 'No puedes calificarte a ti mismo.' }
    }

    if (rating < 1 || rating > 5) {
      return { success: false, error: 'La calificación debe estar entre 1 y 5 estrellas.' }
    }

    // Insertar o actualizar la reseña. El trigger de la DB se encarga del recalcular el promedio.
    // Usamos upsert basado en el UNIQUE constraint de reviewer_id y reviewee_id
    const { error } = await supabase.from('reviews').upsert(
      {
        reviewer_id: authData.user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'reviewer_id, reviewee_id' }
    )

    if (error) {
      console.error('Error al guardar reseña:', error)
      return { success: false, error: 'Ocurrió un error al guardar la calificación.' }
    }

    // Refrescar la caché de la página del perfil para que aparezca la nueva reseña inmediatamente
    revalidatePath(`/profile/${revieweeId}`)
    
    return { success: true }
  } catch (err) {
    console.error('Excepción en submitReviewAction:', err)
    return { success: false, error: 'Ocurrió un error interno.' }
  }
}
