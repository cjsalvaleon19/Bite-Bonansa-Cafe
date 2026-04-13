// Re-export the shared Supabase client so API routes and pages
// both use the same singleton instance.
export { supabase } from '../utils/supabaseClient';