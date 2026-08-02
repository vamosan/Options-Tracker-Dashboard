import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize mock if env vars are missing so we don't crash development server completely
export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: null, error: new Error("Missing Supabase Config") })
                })
            }),
            insert: () => Promise.resolve({ error: new Error("Missing Supabase Config") }),
            upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("Missing Supabase Config") }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: new Error("Missing Supabase Config") }) })
        })
    } as any);
