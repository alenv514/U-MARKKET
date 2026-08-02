import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ssfibitjyogzjqnfebtg.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmliaXRqeW9nempxbmZlYnRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUzMTMyNSwiZXhwIjoyMDk5MTA3MzI1fQ.yMh_WNzc9LtJ2oZ09UqQE_UCKAmshyEuXG6OrPwsG6M'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAdmin() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')

  const { data: { users } } = await supabase.auth.admin.listUsers()
  
  const userList = users.map(u => {
    const prof = profiles?.find(p => p.id === u.id)
    return {
      email: u.email,
      name: prof?.full_name || u.user_metadata?.full_name,
      role: prof?.role || 'buyer'
    }
  })

  console.log('USER_LIST_RESULT:', JSON.stringify(userList, null, 2))
}

checkAdmin()
