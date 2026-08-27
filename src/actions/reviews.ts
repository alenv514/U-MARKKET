'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitReviewAction(revieweeId: string, rating: number, comment: string) {
  try {
    const supabase = await createClient()

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

    // Verificar que existe una interacción previa (chat) entre ambos usuarios.
    // La policy RLS de reviews también lo exige; esto solo da un mensaje amigable.
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .or(`and(buyer_id.eq.${authData.user.id},seller_id.eq.${revieweeId}),and(seller_id.eq.${authData.user.id},buyer_id.eq.${revieweeId})`)
      .limit(1)
      .maybeSingle()

    if (!existingChat) {
      return { success: false, error: 'Solo puedes calificar a usuarios con los que hayas tenido una conversación.' }
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
