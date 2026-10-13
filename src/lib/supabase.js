import { createClient } from '@supabase/supabase-js'

// Publishable client configuration only. Never place a service-role key in frontend code.
// Environment variables can override these public project settings for preview deployments.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://evtkeyfjgqwarsmlzrkh.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7lGio_RVVgkVASYYyBHQIg_GvL-8ELD'

export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Share the central platform session; do not create a second independent login.
    storageKey: 'jfs-ai-platform-auth',
  },
}) : null
export const supabaseConfigured = Boolean(supabase)
