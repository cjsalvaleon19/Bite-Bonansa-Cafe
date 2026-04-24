// Singleton Supabase client for both App Router and Pages Router
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
  throw new Error('Supabase URL is not configured')
}
if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key is not configured')
}

// Create and export singleton Supabase client instance
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// For backwards compatibility
export function createClient() {
  return supabase
}
