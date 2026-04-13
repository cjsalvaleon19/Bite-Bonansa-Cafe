import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabaseClient = null

function getSupabase() {
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    } catch {
      // will be null if URL is not yet configured
    }
  }
  return supabaseClient
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getSupabase()
    if (!client) return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})
