import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ListingDetailClient from './ListingDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: listing } = await supabase
      .from('listings')
      .select('title, description, price, image_url')
      .eq('id', id)
      .maybeSingle()

    if (!listing) {
      return {
        title: 'Publicación no encontrada — U-Market UTA',
        description: 'La publicación solicitada no existe o fue dada de baja.',
      }
    }

    const priceFormatted = `$${Number(listing.price || 0).toFixed(2)}`
    const title = `${listing.title} (${priceFormatted}) — U-Market UTA`
    const description = listing.description?.slice(0, 160) || `Encuentra ${listing.title} en U-Market, el marketplace oficial de la UTA.`
    const images = listing.image_url ? [listing.image_url] : []

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images,
      },
    }
  } catch {
    return {
      title: 'U-Market UTA — Detalle de Publicación',
    }
  }
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params
  return <ListingDetailClient id={id} />
}
