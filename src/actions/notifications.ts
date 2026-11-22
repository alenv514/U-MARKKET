'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import webpush from 'web-push'

const isPushRateLimited = createRateLimiter(20, 60_000)
let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails('mailto:support@u-market.com', publicKey, privateKey)
  vapidConfigured = true
  return true
}

export async function sendNotificationAction(
  chatId: string,
  messageContent: string
) {
  try {
    if (!chatId || typeof chatId !== 'string' || !messageContent || typeof messageContent !== 'string') {
      return { success: false }
    }

    if (!ensureVapidConfigured()) {
      return { success: false }
    }

    const supabaseClient = await createClient()

    // 1. Verificar que el usuario que llama la Server Action está autenticado
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return { success: false }
    }

    if (isPushRateLimited(`push:${user.id}`)) {
      return { success: false }
    }

    const supabaseAdmin = createServiceClient()

    // 2. Verificar que el chat existe y el remitente es participante real
    const { data: validChat, error: chatError } = await supabaseAdmin
      .from('chats')
      .select('id, buyer_id, seller_id')
      .eq('id', chatId)
      .maybeSingle()

    if (chatError || !validChat) {
      return { success: false }
    }

    const isBuyer = validChat.buyer_id === user.id
    const isSeller = validChat.seller_id === user.id
    if (!isBuyer && !isSeller) {
      return { success: false }
    }

    const recipientId = isBuyer ? validChat.seller_id : validChat.buyer_id
    if (!recipientId || recipientId === user.id) {
      return { success: false }
    }

    // 3. Derivar nombre del remitente desde el servidor (evita spoofing)
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const safeSenderName = senderProfile?.full_name?.trim() || 'Alguien'
    const safeChatUrl = `/inbox/${validChat.id}`

    // 4. Enviar Notificación Web Push al navegador/celular del destinatario
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', recipientId)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: `Nuevo mensaje de ${safeSenderName}`,
        body: messageContent.trim().slice(0, 150),
        url: safeChatUrl,
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


