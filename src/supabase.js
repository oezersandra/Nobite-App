import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://iyulwyxipjagzvpsoubs.supabase.co'
const supabaseAnonKey = 'sb_publishable_7pAnztdHHUJe5lP3I8eQyA_1DfaSiHT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
