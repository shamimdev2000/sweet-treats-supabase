/*
# Expenses, Staff, Attendance, and Deductions

## Purpose
Creates the expense tracking and HR (staff management) tables with branch-level isolation.

## New Tables

### 1. public.expenses
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `description` (text, NOT NULL)
- `amount` (numeric(14,2), NOT NULL, CHECK > 0)
- `category` (text, NOT NULL, default 'Other') — 'Raw Material', 'Utilities', 'Rent', 'Staff', 'Salary', 'Other'
- `date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

### 2. public.staff
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `name` (text, NOT NULL)
- `designation` (text, NOT NULL)
- `monthly_salary` (numeric(14,2), NOT NULL, default 0)
- `join_date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

### 3. public.attendance
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `staff_id` (uuid, NOT NULL, references staff.id, ON DELETE CASCADE)
- `date` (date, NOT NULL) — YYYY-MM-DD
- `status` (text, NOT NULL) — 'Present', 'Late', 'Absent'
- `created_at` (timestamptz, default now())
- UNIQUE(staff_id, date) — one attendance record per staff per day
- CHECK: status IN ('Present', 'Late', 'Absent')

### 4. public.deductions
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `staff_id` (uuid, NOT NULL, references staff.id, ON DELETE CASCADE)
- `amount` (numeric(14,2), NOT NULL, CHECK > 0)
- `reason` (text, NOT NULL)
- `date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

## RLS Policies
All tables use branch-scoped policies with has_branch_access() or is_admin().
*/

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Other',
  date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STAFF TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text NOT NULL,
  monthly_salary numeric(14,2) NOT NULL DEFAULT 0,
  join_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ATTENDANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Present', 'Late', 'Absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEDUCTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: EXPENSES
-- ============================================================================
DROP POLICY IF EXISTS "expenses_select_branch" ON public.expenses;
CREATE POLICY "expenses_select_branch"
ON public.expenses FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "expenses_insert_branch" ON public.expenses;
CREATE POLICY "expenses_insert_branch"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "expenses_delete_branch" ON public.expenses;
CREATE POLICY "expenses_delete_branch"
ON public.expenses FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: STAFF
-- ============================================================================
DROP POLICY IF EXISTS "staff_select_branch" ON public.staff;
CREATE POLICY "staff_select_branch"
ON public.staff FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "staff_insert_branch" ON public.staff;
CREATE POLICY "staff_insert_branch"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "staff_update_branch" ON public.staff;
CREATE POLICY "staff_update_branch"
ON public.staff FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "staff_delete_branch" ON public.staff;
CREATE POLICY "staff_delete_branch"
ON public.staff FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: ATTENDANCE
-- ============================================================================
DROP POLICY IF EXISTS "attendance_select_branch" ON public.attendance;
CREATE POLICY "attendance_select_branch"
ON public.attendance FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "attendance_insert_branch" ON public.attendance;
CREATE POLICY "attendance_insert_branch"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "attendance_update_branch" ON public.attendance;
CREATE POLICY "attendance_update_branch"
ON public.attendance FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "attendance_delete_branch" ON public.attendance;
CREATE POLICY "attendance_delete_branch"
ON public.attendance FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: DEDUCTIONS
-- ============================================================================
DROP POLICY IF EXISTS "deductions_select_branch" ON public.deductions;
CREATE POLICY "deductions_select_branch"
ON public.deductions FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "deductions_insert_branch" ON public.deductions;
CREATE POLICY "deductions_insert_branch"
ON public.deductions FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "deductions_delete_branch" ON public.deductions;
CREATE POLICY "deductions_delete_branch"
ON public.deductions FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deductions TO authenticated;
