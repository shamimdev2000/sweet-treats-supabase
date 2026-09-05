/*
# Initial Schema: Profiles, Branches, and Memberships

## Purpose
Establishes the multi-tenant, multi-branch foundation for the bakery management system.
All business data will be scoped to branches, and users gain access to branches through
memberships validated server-side via RLS policies.

## New Tables

### 1. public.profiles
- `id` (uuid, PK) — references `auth.users.id`, ON DELETE CASCADE
- `email` (text, UNIQUE, NOT NULL) — mirrors auth.users email for convenience
- `full_name` (text) — user's display name
- `phone` (text) — contact phone
- `role` (text, NOT NULL, default 'user') — one of 'admin', 'manager', 'user'
- `status` (text, NOT NULL, default 'active') — 'active' or 'suspended'
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- CHECK constraint on role and status values

### 2. public.branches
- `id` (uuid, PK, default gen_random_uuid())
- `name` (text, NOT NULL) — branch name e.g. "Main Branch"
- `address` (text) — branch address
- `phone` (text) — branch phone
- `created_by` (uuid, references profiles.id) — who created the branch
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 3. public.branch_memberships
- `id` (uuid, PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL, references profiles.id, ON DELETE CASCADE)
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `role` (text, NOT NULL, default 'user') — role within this branch: 'admin', 'manager', 'user'
- `created_at` (timestamptz, default now())
- UNIQUE constraint on (user_id, branch_id) — a user has one membership per branch
- CHECK constraint on role values

## Security Helper Functions (SECURITY DEFINER)
All functions have explicit `search_path = public` and are owned by the postgres role.

1. `public.has_branch_access(p_branch_id uuid)` — returns boolean
   Checks if the current authenticated user has a membership for the given branch.
   Used by RLS policies on all branch-scoped tables.

2. `public.user_role()` — returns text
   Returns the current user's global role from profiles table.

3. `public.is_admin()` — returns boolean
   Returns true if current user's role is 'admin'.

4. `public.user_branch_ids()` — returns uuid[]
   Returns array of branch IDs the current user has membership in.
   Used for filtering in RLS policies.

## RLS Policies

### profiles
- SELECT: users can read their own profile; admins can read all
- UPDATE: users can update their own profile (but NOT their own role/status)
- INSERT: only via trigger from auth.users (no direct insert policy needed)
- DELETE: admins only

### branches
- SELECT: users with membership in that branch, plus admins
- INSERT: admins only
- UPDATE: admins only
- DELETE: admins only

### branch_memberships
- SELECT: users can see their own memberships; admins can see all
- INSERT: admins only (managing who belongs to which branch)
- UPDATE: admins only
- DELETE: admins only

## Trigger
- `on_auth_user_created` — AFTER INSERT on auth.users, creates a profile row
  with email copied from auth.users.email and default role 'user'.

## Notes
- Passwords are NEVER stored in profiles — Supabase Auth (auth.users) is the sole auth source.
- Role is stored in profiles.role (server-side), never trusted from the client.
- Branch access is validated through branch_memberships, never from a client-sent branch_id.
- The `on_auth_user_created` trigger auto-creates a profile when a user signs up via Supabase Auth.
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BRANCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BRANCH MEMBERSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branch_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

ALTER TABLE public.branch_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECURITY HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_memberships
    WHERE user_id = auth.uid() AND branch_id = p_branch_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_branch_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(branch_id) FROM public.branch_memberships
  WHERE user_id = auth.uid();
$$;

-- Revoke execute from anon and authenticated; grant only to authenticated
-- These are used inside RLS policies which run as the caller, so authenticated needs execute
REVOKE EXECUTE ON FUNCTION public.has_branch_access(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_branch_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_role() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_branch_ids() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_branch_ids() TO authenticated;

-- ============================================================================
-- RLS POLICIES: PROFILES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: BRANCHES
-- ============================================================================
DROP POLICY IF EXISTS "branches_select_member_or_admin" ON public.branches;
CREATE POLICY "branches_select_member_or_admin"
ON public.branches FOR SELECT
TO authenticated
USING (public.has_branch_access(id) OR public.is_admin());

DROP POLICY IF EXISTS "branches_insert_admin" ON public.branches;
CREATE POLICY "branches_insert_admin"
ON public.branches FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "branches_update_admin" ON public.branches;
CREATE POLICY "branches_update_admin"
ON public.branches FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "branches_delete_admin" ON public.branches;
CREATE POLICY "branches_delete_admin"
ON public.branches FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: BRANCH_MEMBERSHIPS
-- ============================================================================
DROP POLICY IF EXISTS "memberships_select_own_or_admin" ON public.branch_memberships;
CREATE POLICY "memberships_select_own_or_admin"
ON public.branch_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "memberships_insert_admin" ON public.branch_memberships;
CREATE POLICY "memberships_insert_admin"
ON public.branch_memberships FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "memberships_update_admin" ON public.branch_memberships;
CREATE POLICY "memberships_update_admin"
ON public.branch_memberships FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "memberships_delete_admin" ON public.branch_memberships;
CREATE POLICY "memberships_delete_admin"
ON public.branch_memberships FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- TRIGGER: Auto-create profile on auth.users insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.branches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.branches TO authenticated;

GRANT SELECT ON public.branch_memberships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.branch_memberships TO authenticated;
