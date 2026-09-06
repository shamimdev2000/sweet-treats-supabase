import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Returns the active user ID from Supabase Auth or null
 */
export async function getActiveUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (err) {
    console.error('Error fetching Supabase user:', err);
    return null;
  }
}

/**
 * Checks if a Supabase error is caused by missing tables or functions in the PostgREST schema cache
 * (e.g. freshly created Supabase project before database migrations are run).
 */
export function isPgrstMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = typeof error.message === 'string' ? error.message : '';
  const details = typeof error.details === 'string' ? error.details : '';
  return (
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    message.includes('Could not find the function') ||
    details.includes('schema cache')
  );
}
