/*
# Daily Closings, Monthly Closings, Daily Notes, and Audit Logs

## Purpose
Creates the closing/accounting tables, daily notes, and audit logging system.

## New Tables

### 1. public.daily_closings
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `date` (date, NOT NULL) — YYYY-MM-DD
- `total_sales` (numeric(14,2), NOT NULL, default 0)
- `total_cash_collected` (numeric(14,2), NOT NULL, default 0)
- `total_cash_payments` (numeric(14,2), NOT NULL, default 0)
- `total_mobile_payments` (numeric(14,2), NOT NULL, default 0)
- `total_expenses` (numeric(14,2), NOT NULL, default 0)
- `total_wastage` (numeric(14,2), NOT NULL, default 0)
- `system_balance` (numeric(14,2), NOT NULL, default 0)
- `actual_cash` (numeric(14,2), NOT NULL, default 0)
- `difference` (numeric(14,2), NOT NULL, default 0)
- `closed_by` (text, NOT NULL) — user email for historical compatibility
- `timestamp` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

### 2. public.monthly_closings
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `month` (text, NOT NULL) — e.g. "September 2026"
- `total_sales` (numeric(14,2), NOT NULL, default 0)
- `total_cash_payments` (numeric(14,2), NOT NULL, default 0)
- `total_mobile_payments` (numeric(14,2), NOT NULL, default 0)
- `total_expenses` (numeric(14,2), NOT NULL, default 0)
- `total_wastage` (numeric(14,2), NOT NULL, default 0)
- `total_profit` (numeric(14,2), NOT NULL, default 0)
- `total_dues` (numeric(14,2), NOT NULL, default 0)
- `closed_by` (text, NOT NULL) — user email
- `timestamp` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

### 3. public.daily_notes
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `title` (text, NOT NULL)
- `content` (text, NOT NULL, default '')
- `priority` (text, NOT NULL, default 'normal') — 'normal', 'urgent', 'info'
- `status` (text, NOT NULL, default 'active') — 'active', 'completed'
- `assigned_to` (text) — staff name or 'All Staff'
- `author` (text, NOT NULL) — user email
- `pinned` (boolean, NOT NULL, default false)
- `created_at` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)
- CHECK: priority IN ('normal', 'urgent', 'info'), status IN ('active', 'completed')

### 4. public.audit_logs
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, references branches.id, ON DELETE CASCADE) — nullable for global actions
- `actor_id` (uuid, references profiles.id) — who performed the action
- `action` (text, NOT NULL) — e.g. 'sale_created', 'sale_cancelled', 'product_updated'
- `entity_type` (text) — table name affected
- `entity_id` (uuid) — ID of affected record
- `metadata` (jsonb) — additional context
- `created_at` (timestamptz, NOT NULL, default now())

## RLS Policies
All business tables use branch-scoped policies.
Audit logs are read-only for non-admins (select only), admin can delete.
*/

-- ============================================================================
-- DAILY CLOSINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_sales numeric(14,2) NOT NULL DEFAULT 0,
  total_cash_collected numeric(14,2) NOT NULL DEFAULT 0,
  total_cash_payments numeric(14,2) NOT NULL DEFAULT 0,
  total_mobile_payments numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  total_wastage numeric(14,2) NOT NULL DEFAULT 0,
  system_balance numeric(14,2) NOT NULL DEFAULT 0,
  actual_cash numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  closed_by text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MONTHLY CLOSINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  month text NOT NULL,
  total_sales numeric(14,2) NOT NULL DEFAULT 0,
  total_cash_payments numeric(14,2) NOT NULL DEFAULT 0,
  total_mobile_payments numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  total_wastage numeric(14,2) NOT NULL DEFAULT 0,
  total_profit numeric(14,2) NOT NULL DEFAULT 0,
  total_dues numeric(14,2) NOT NULL DEFAULT 0,
  closed_by text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DAILY NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'info')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  assigned_to text,
  author text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: DAILY CLOSINGS
-- ============================================================================
DROP POLICY IF EXISTS "daily_closings_select_branch" ON public.daily_closings;
CREATE POLICY "daily_closings_select_branch"
ON public.daily_closings FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_closings_insert_branch" ON public.daily_closings;
CREATE POLICY "daily_closings_insert_branch"
ON public.daily_closings FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_closings_update_branch" ON public.daily_closings;
CREATE POLICY "daily_closings_update_branch"
ON public.daily_closings FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_closings_delete_branch" ON public.daily_closings;
CREATE POLICY "daily_closings_delete_branch"
ON public.daily_closings FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: MONTHLY CLOSINGS
-- ============================================================================
DROP POLICY IF EXISTS "monthly_closings_select_branch" ON public.monthly_closings;
CREATE POLICY "monthly_closings_select_branch"
ON public.monthly_closings FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "monthly_closings_insert_branch" ON public.monthly_closings;
CREATE POLICY "monthly_closings_insert_branch"
ON public.monthly_closings FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "monthly_closings_delete_branch" ON public.monthly_closings;
CREATE POLICY "monthly_closings_delete_branch"
ON public.monthly_closings FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: DAILY NOTES
-- ============================================================================
DROP POLICY IF EXISTS "daily_notes_select_branch" ON public.daily_notes;
CREATE POLICY "daily_notes_select_branch"
ON public.daily_notes FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_notes_insert_branch" ON public.daily_notes;
CREATE POLICY "daily_notes_insert_branch"
ON public.daily_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_notes_update_branch" ON public.daily_notes;
CREATE POLICY "daily_notes_update_branch"
ON public.daily_notes FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "daily_notes_delete_branch" ON public.daily_notes;
CREATE POLICY "daily_notes_delete_branch"
ON public.daily_notes FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: AUDIT LOGS
-- ============================================================================
DROP POLICY IF EXISTS "audit_logs_select_branch_or_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_branch_or_admin"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  (branch_id IS NOT NULL AND public.has_branch_access(branch_id))
  OR public.is_admin()
  OR actor_id = auth.uid()
);

DROP POLICY IF EXISTS "audit_logs_insert_branch" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_branch"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  (branch_id IS NOT NULL AND public.has_branch_access(branch_id))
  OR branch_id IS NULL
);

DROP POLICY IF EXISTS "audit_logs_delete_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_admin"
ON public.audit_logs FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_closings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.monthly_closings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_notes TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT DELETE ON public.audit_logs TO authenticated;
