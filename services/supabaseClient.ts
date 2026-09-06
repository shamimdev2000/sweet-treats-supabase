import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// Strip any trailing slashes or accidental /rest/v1 suffixes from the base URL
const cleanUrl = rawUrl ? rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '') : undefined;
const cleanAnonKey = rawKey;

export const isSupabaseConfigured = Boolean(
  cleanUrl && 
  cleanAnonKey && 
  cleanUrl.startsWith('https://') &&
  cleanAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(cleanUrl!, cleanAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
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
 * Checks if a Supabase error is caused by missing tables/functions in the PostgREST schema cache or 404
 * (e.g. freshly created Supabase project before database migrations are run).
 */
export function isPgrstMissingTableError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode;
  const code = error.code;
  const message = typeof error.message === 'string' ? error.message : '';
  const details = typeof error.details === 'string' ? error.details : '';
  const hint = typeof error.hint === 'string' ? error.hint : '';
  return (
    status === 404 ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === 'PGRST106' ||
    code === '42P01' ||
    code === '42883' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    message.includes('Could not find the function') ||
    message.includes('does not exist') ||
    details.includes('schema cache') ||
    hint.includes('schema cache')
  );
}
