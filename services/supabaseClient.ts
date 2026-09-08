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
 * Generates a deterministic RFC4122-compliant UUID string based on an email address.
 * Ensures consistent tenant identification even if Supabase Auth email confirmation is pending.
 */
export function getDeterministicUserId(email?: string): string {
  const clean = (email || 'bakery_owner@sweetlive.com').trim().toLowerCase();
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = (Math.abs(hash1 ^ hash2)).toString(16).padStart(8, '0');
  return `00000000-${hex1.slice(0, 4)}-4000-8000-${(hex2 + hex3).slice(0, 12)}`;
}

/**
 * Returns the active user ID from Supabase Auth or derives a deterministic ID from the tenant email.
 */
export async function getActiveUserId(fallbackEmail?: string): Promise<string | null> {
  if (!supabase) return fallbackEmail ? getDeterministicUserId(fallbackEmail) : null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch (err) {
    console.warn('Error fetching Supabase auth session:', err);
  }
  if (fallbackEmail) {
    return getDeterministicUserId(fallbackEmail);
  }
  return null;
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
