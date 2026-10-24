import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

const serverAuthOptions = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
}

export const supabaseAuth = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    serverAuthOptions,
)

export function createUserSupabase(accessToken) {
    return createClient(
        env.SUPABASE_URL,
        env.SUPABASE_PUBLISHABLE_KEY,
        {
        ...serverAuthOptions,
        global: {
            headers: {
            Authorization: `Bearer ${accessToken}`,
            },
        },
        },
    )
}