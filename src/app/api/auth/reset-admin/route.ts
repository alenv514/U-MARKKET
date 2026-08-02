import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { newPassword } = await req.json()
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError

    const adminUser = users.find(u => u.email === 'avillamarin8139@uta.edu.ec')
    if (!adminUser) {
      return NextResponse.json({ error: 'Usuario administrador no encontrado' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
      password: newPassword,
      email_confirm: true
    })

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Contraseña de administrador actualizada con éxito' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en el servidor' }, { status: 500 })
  }
}
