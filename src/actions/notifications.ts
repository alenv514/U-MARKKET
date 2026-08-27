'use server'

import nodemailer from 'nodemailer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { escapeHtml } from '@/lib/utils'

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

    let pushSent = false

    // Fetch push subscriptions
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

      const results = await Promise.all(pushPromises)
      if (results.some(r => r === true)) pushSent = true
    }

    if (pushSent) {
      return { success: true }
    }

    // Fallback a Correo
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(recipientId)
    if (userError || !userData?.user?.email) {
      console.error('Error obteniendo correo:', userError)
      return { success: false }
    }

    const recipientEmail = userData.user.email

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    // Escapar todos los campos antes de interpolar en HTML
    const safeRecipientName = escapeHtml(recipientName)
    const safeSenderName = escapeHtml(senderName)
    const safeListingTitle = escapeHtml(listingTitle)
    const safeMessageContent = escapeHtml(messageContent.slice(0, 500))
    const safeChatUrl = chatUrl.startsWith('http://') || chatUrl.startsWith('https://') || chatUrl.startsWith('/')
      ? chatUrl
      : '/'

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #6366f1; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">U-Market</h1>
        </div>
        <div style="padding: 20px; background-color: #ffffff;">
          <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Hola, ${safeRecipientName} 👋</h2>
          <p style="color: #4b5563; font-size: 16px;">
            <strong>${safeSenderName}</strong> te ha enviado un nuevo mensaje sobre tu publicación <strong>${safeListingTitle}</strong>.
          </p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #374151;">
            "${safeMessageContent}"
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${safeChatUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 99px; font-weight: bold; display: inline-block;">
              Responder Mensaje
            </a>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
          Este es un mensaje automático de U-Market de la Universidad Técnica de Ambato.
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `"U-Market" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `Nuevo mensaje de ${safeSenderName} en U-Market`,
      html: htmlContent,
    })

    return { success: true }
  } catch (error) {
    console.error('Error crítico en notificacion:', error)
    return { success: false }
  }
}

