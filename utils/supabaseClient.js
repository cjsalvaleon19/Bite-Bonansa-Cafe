import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function createSupabaseClient() {
  try {
    // Check if URL exists AND is a valid HTTP URL
    if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
      console.warn('Supabase URL is not configured. Auth features will not work.')
      return null
    }
    if (!supabaseAnonKey) {
      console.warn('Supabase Anon Key is not configured. Auth features will not work.')
      return null
    }
    return createClient(supabaseUrl, supabaseAnonKey)
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err.message)
    return null
  }
}

export const supabase = createSupabaseClient()
