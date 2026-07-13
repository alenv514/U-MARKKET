'use server'

import nodemailer from 'nodemailer'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local para leer el correo')
      return { success: false }
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    let pushSent = false

    // Fetch push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recipientId)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: `Nuevo mensaje de ${senderName}`,
        body: messageContent,
        url: chatUrl,
      })

      const pushPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          }, payload)
          return true
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
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

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #6366f1; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">U-Market</h1>
        </div>
        <div style="padding: 20px; background-color: #ffffff;">
          <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Hola, ${recipientName} 👋</h2>
          <p style="color: #4b5563; font-size: 16px;">
            <strong>${senderName}</strong> te ha enviado un nuevo mensaje sobre tu publicación <strong>${listingTitle}</strong>.
          </p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #374151;">
            "${messageContent}"
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${chatUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 99px; font-weight: bold; display: inline-block;">
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
      subject: `Nuevo mensaje de ${senderName} en U-Market`,
      html: htmlContent,
    })

    return { success: true }
  } catch (error) {
    console.error('Error crítico en notificacion:', error)
    return { success: false }
  }
}
