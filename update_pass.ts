import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ssfibitjyogzjqnfebtg.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmliaXRqeW9nempxbmZlYnRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUzMTMyNSwiZXhwIjoyMDk5MTA3MzI1fQ.yMh_WNzc9LtJ2oZ09UqQE_UCKAmshyEuXG6OrPwsG6M'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetPass() {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const admin = users.find(u => u.email === 'avillamarin8139@uta.edu.ec')
  if (!admin) {
    console.log('No admin found with email avillamarin8139@uta.edu.ec')
    return
  }
  const newPass = 'Admin2026*'
  const { error } = await supabase.auth.admin.updateUserById(admin.id, {
    password: newPass,
    email_confirm: true
  })
  if (error) {
    console.error('Error al actualizar contraseña:', error)
  } else {
    console.log(`✅ Contraseña de ${admin.email} cambiada exitosamente a: ${newPass}`)
  }
}

resetPass()
