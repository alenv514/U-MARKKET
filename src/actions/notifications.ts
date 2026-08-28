'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:support@u-market.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

export async function sendNotificationAction(
  recipientId: string,
  recipientName: string,
  senderName: string,
  messageContent: string,
  listingTitle: string,
  chatUrl: string
) {
  try {
    const supabaseClient = await createClient()

    // 1. Verificar que el usuario que llama la Server Action está autenticado
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      console.warn('sendNotificationAction rechazada: usuario no autenticado')
      return { success: false }
    }

    // No permitir enviarse notificaciones a uno mismo
    if (user.id === recipientId) {
      return { success: false }
    }

    const supabaseAdmin = createServiceClient()

    // 2. Verificar que existe un chat activo entre el llamador y el destinatario
    const { data: validChat, error: chatError } = await supabaseAdmin
      .from('chats')
      .select('id')
      .or(`and(buyer_id.eq.${user.id},seller_id.eq.${recipientId}),and(seller_id.eq.${user.id},buyer_id.eq.${recipientId})`)
      .limit(1)
      .maybeSingle()

    if (chatError || !validChat) {
      console.warn('sendNotificationAction rechazada: no existe chat entre los usuarios')
      return { success: false }
    }

    // 3. Enviar únicamente Notificación Web Push al navegador/celular del destinatario
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recipientId)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: `Nuevo mensaje de ${senderName}`,
        body: messageContent.slice(0, 150),
        url: chatUrl,
      })

      const pushPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          }, payload)
          return true
        } catch (err: unknown) {
          const e = err as { statusCode?: number }
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          }
          return false
        }
      })

      await Promise.all(pushPromises)
    }

    return { success: true }
  } catch (error) {
    console.error('Error enviando notificación push:', error)
    return { success: false }
  }
}


