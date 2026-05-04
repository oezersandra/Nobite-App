import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iyulwyxipjagzvpsoubs.supabase.co'
const supabaseAnonKey = 'sb_publishable_7pAnztdHHUJe5lP3I8eQyA_1DfaSiHT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
