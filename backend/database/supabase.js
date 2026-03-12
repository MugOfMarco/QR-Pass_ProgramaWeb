// ============================================================
// ARCHIVO 1: backend/database/supabase.js
// ============================================================
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Cliente público — operaciones normales con RLS
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);

// Cliente admin — operaciones privilegiadas sin RLS
// SOLO usar en el backend, NUNCA en el frontend
export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);