'use client'

import { useEffect } from 'react'
import { savePushSubscriptionAction } from '@/actions/push'
import type { User } from '@supabase/supabase-js'

export default function PushManager({ user }: { user: User | { id: string } | null }) {
  useEffect(() => {
    if (!user) return
    const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    if (!isSupported) return

    const registerAndSubscribe = async () => {
      try {
        // Register SW
        const registration = await navigator.serviceWorker.register('/sw.js')
        
        // Wait for it to be active
        await navigator.serviceWorker.ready

        // Request permission if not already granted or denied
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return
        }

        if (Notification.permission === 'granted') {
          // Check existing subscription
          let subscription = await registration.pushManager.getSubscription()
          
          if (!subscription) {
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!publicVapidKey) {
              console.error('VAPID public key not found')
              return
            }

            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            })
          }

          // Send to server
          await savePushSubscriptionAction(JSON.parse(JSON.stringify(subscription)))
        }
      } catch (error: unknown) {
        // En navegadores como Brave o en local sin servicio de push activo, se silencia o advierte
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('Servicio de Push Notifications no disponible en este navegador o bloqueado por el cliente.')
        } else {
          console.warn('No se pudo registrar Push Notifications:', error)
        }
      }
    }

    registerAndSubscribe()
  }, [user])

  return null
}

// Utility to convert Base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

