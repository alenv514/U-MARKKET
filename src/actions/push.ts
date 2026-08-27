'use server'

import { createClient } from '@/lib/supabase/server'

interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function savePushSubscriptionAction(subscription: PushSubscriptionPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Parse keys
  const endpoint = subscription.endpoint
  const p256dh = subscription.keys.p256dh
  const auth = subscription.keys.auth

  // Insert or handle conflict (we set UNIQUE on endpoint)
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('Error saving push subscription:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
