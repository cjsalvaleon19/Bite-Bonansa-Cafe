import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a singleton Supabase client instance
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

function getSupabaseClient() {
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
    throw new Error('Supabase URL is not configured')
  }
  if (!supabaseAnonKey) {
    throw new Error('Supabase Anon Key is not configured')
  }
  
  // Return existing instance if it exists
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  // Create new instance only if it doesn't exist
  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Export singleton instance
export const supabase = getSupabaseClient()

// Keep the createClient function for backwards compatibility, but return the singleton
export function createClient() {
  return supabase
}
