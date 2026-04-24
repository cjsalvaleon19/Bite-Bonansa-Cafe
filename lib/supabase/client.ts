// Singleton Supabase client for both App Router and Pages Router
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a singleton Supabase client instance
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

function getSupabaseClient() {
  // Return existing instance if it exists
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  // Validate environment variables
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
    throw new Error('Supabase URL is not configured')
  }
  if (!supabaseAnonKey) {
    throw new Error('Supabase Anon Key is not configured')
  }
  
  // Create new instance only if it doesn't exist
  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Export singleton instance
export const supabase = getSupabaseClient()

// For backwards compatibility
export function createClient() {
  return supabase
}
