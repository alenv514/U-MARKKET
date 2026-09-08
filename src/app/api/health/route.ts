import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Endpoint liviano para mantener Supabase despierto (prevenir pausa por inactividad en free tier)
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ok',
      active_listings: count,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 500 })
  }
}
