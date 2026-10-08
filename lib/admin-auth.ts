import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-admin'

// Checks the credentials against Supabase Auth and that the user is listed in public.admin_users.
// Returns the admin's user id, or null when the credentials or the permission are wrong.
export async function verifyAdminCredentials(email: string, password: string) {
  if (!email.trim() || !password) return null
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado')

  // Throwaway client so the sign-in never leaves a session behind in the shared admin client.
  const auth = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await auth.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) {
    // Wrong credentials are a normal outcome; anything else (network, 5xx) is a real failure.
    if (error.status && error.status >= 500) throw error
    return null
  }
  const userId = data.user?.id
  if (!userId) return null

  const { data: admin, error: adminError } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
  if (adminError) throw adminError
  return admin ? userId : null
}
