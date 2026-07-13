import type { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateChat(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
  sellerId: string
): Promise<string | null> {
  // Prevent creating chat with oneself
  if (buyerId === sellerId) {
    return null
  }

  // Check if chat already exists
  const { data: existingChat, error: checkError } = await supabase
    .from('chats')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .maybeSingle()

  if (checkError) {
    console.error('Error checking existing chat:', checkError.message)
    return null
  }

  if (existingChat) {
    return existingChat.id
  }

  // Create new chat
  const { data: newChat, error: insertError } = await supabase
    .from('chats')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Error creating chat:', insertError.message)
    return null
  }

  return newChat.id
}
