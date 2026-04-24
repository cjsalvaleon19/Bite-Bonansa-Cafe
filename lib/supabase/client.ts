import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
    throw new Error('Supabase URL is not configured')
  }
  if (!supabaseAnonKey) {
    throw new Error('Supabase Anon Key is not configured')
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
