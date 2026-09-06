-- ============================================================================
-- Migration: Fix Multi-Branch & Multi-Tenant RLS Security
-- Filename: 20260906120000_fix_multibranch_rls_security.sql
-- ============================================================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. STRUCTURAL ALIGNMENT: Branches & Branch Memberships
-- ----------------------------------------------------------------------------

-- Ensure branches table has created_by and updated_at
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'created_by') THEN
        ALTER TABLE public.branches ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'updated_at') THEN
        ALTER TABLE public.branches ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Ensure branch_memberships table exists with proper columns and constraints
CREATE TABLE IF NOT EXISTS public.branch_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, branch_id)
);

-- Drop legacy check constraint if exists, and apply full role constraint
DO $$ BEGIN
    ALTER TABLE public.branch_memberships DROP CONSTRAINT IF EXISTS branch_memberships_role_check;
    ALTER TABLE public.branch_memberships ADD CONSTRAINT branch_memberships_role_check 
        CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'staff', 'user'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.branch_memberships ENABLE ROW LEVEL SECURITY;

-- Remove any default insecure PIN on profiles and ensure profile columns
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'manager_pin') THEN
        ALTER TABLE public.profiles ALTER COLUMN manager_pin DROP DEFAULT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'branch_id') THEN
        ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'owner';
    END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure branch_id exists and RLS is enabled on all operational tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'products', 'sales', 'expenses', 'wastage', 'staff', 
        'attendance', 'deductions', 'daily_closings', 'monthly_closings', 
        'production', 'daily_notes'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DO $inner$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = %L AND column_name = ''branch_id'') THEN
                    ALTER TABLE public.%I ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
                END IF;
            END $inner$;
            ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;
        ', tbl, tbl, tbl);
    END LOOP;
END $$;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. PRESERVE PRODUCTION DATA: Safe Backfill
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_b_id UUID;
    v_b_name TEXT;
BEGIN
    FOR r IN SELECT * FROM public.profiles LOOP
        -- Determine branch ID for this profile
        v_b_id := NULL;

        SELECT branch_id INTO v_b_id 
        FROM public.branch_memberships 
        WHERE user_id = r.id 
        LIMIT 1;

        IF v_b_id IS NULL THEN
            IF r.branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.branches WHERE id = r.branch_id) THEN
                v_b_id := r.branch_id;
                UPDATE public.branches 
                SET created_by = COALESCE(created_by, r.id) 
                WHERE id = v_b_id;
            ELSE
                v_b_name := COALESCE(NULLIF(TRIM(r.business_name), ''), 'Main Branch');
                INSERT INTO public.branches (id, name, address, phone, is_main, created_by)
                VALUES (gen_random_uuid(), v_b_name, r.address, r.phone, true, r.id)
                RETURNING id INTO v_b_id;

                UPDATE public.profiles 
                SET branch_id = v_b_id 
                WHERE id = r.id;
            END IF;

            INSERT INTO public.branch_memberships (user_id, branch_id, role)
            VALUES (r.id, v_b_id, COALESCE(r.role, 'owner'))
            ON CONFLICT (user_id, branch_id) DO NOTHING;
        END IF;

        -- Associate operational records with NULL branch_id to user's verified branch
        IF v_b_id IS NOT NULL THEN
            UPDATE public.products SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.sales SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.expenses SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.wastage SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.staff SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.attendance SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.deductions SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.daily_closings SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.monthly_closings SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.production SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
            UPDATE public.daily_notes SET branch_id = v_b_id WHERE user_id = r.id AND branch_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. CORE SECURITY DEFINER FUNCTIONS (Strictly Scoped & Search Path Hardened)
-- ----------------------------------------------------------------------------

-- A. Get user's verified role within a specific branch
CREATE OR REPLACE FUNCTION public.get_branch_role(p_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL OR p_branch_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Check branch memberships table
    SELECT role INTO v_role
    FROM public.branch_memberships
    WHERE user_id = auth.uid() AND branch_id = p_branch_id;

    IF v_role IS NOT NULL THEN
        RETURN v_role;
    END IF;

    -- 2. If user is the creator of the branch, treat as owner
    IF EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND created_by = auth.uid()) THEN
        RETURN 'owner';
    END IF;

    RETURN NULL;
END;
$$;

-- B. Check if caller has verified membership in branch
CREATE OR REPLACE FUNCTION public.has_branch_membership(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT auth.uid() IS NOT NULL AND p_branch_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.branch_memberships bm
            WHERE bm.user_id = auth.uid() AND bm.branch_id = p_branch_id
        ) OR EXISTS (
            SELECT 1 FROM public.branches b
            WHERE b.id = p_branch_id AND b.created_by = auth.uid()
        )
    );
$$;

-- C. Check if caller is branch admin or owner
CREATE OR REPLACE FUNCTION public.is_branch_admin(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT public.get_branch_role(p_branch_id) IN ('owner', 'admin')),
        false
    );
$$;

-- D. Check if caller is branch manager, admin, or owner
CREATE OR REPLACE FUNCTION public.is_branch_manager_or_above(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT public.get_branch_role(p_branch_id) IN ('owner', 'admin', 'manager')),
        false
    );
$$;

-- E. Compatibility wrapper for has_branch_access
CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.has_branch_membership(p_branch_id);
$$;

-- F. Defuse global is_admin() vulnerability
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- Defused global admin backdoor:
    -- Admin permissions are strictly scoped to branches via is_branch_admin(branch_id)
    SELECT false;
$$;

-- G. Helper: user's primary profile role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- H. Helper: array of branch IDs caller belongs to
CREATE OR REPLACE FUNCTION public.user_branch_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(array_agg(branch_id), ARRAY[]::UUID[])
    FROM (
        SELECT branch_id FROM public.branch_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id AS branch_id FROM public.branches WHERE created_by = auth.uid()
    ) sub;
$$;

-- I. Secure ensure_default_branch: binds strictly to auth.uid(), ignores arbitrary emails
CREATE OR REPLACE FUNCTION public.ensure_default_branch(p_user_email TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_profile public.profiles;
    v_branch_id UUID;
    v_branch_name TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication session required.';
    END IF;

    -- Fetch caller's profile strictly by authenticated JWT user ID
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    -- Check if user already has a branch membership
    SELECT bm.branch_id INTO v_branch_id
    FROM public.branch_memberships bm
    WHERE bm.user_id = v_caller_id
    LIMIT 1;

    IF v_branch_id IS NOT NULL THEN
        RETURN v_branch_id;
    END IF;

    -- If profile already has an existing valid branch_id
    IF v_profile.branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.branches WHERE id = v_profile.branch_id) THEN
        v_branch_id := v_profile.branch_id;
        INSERT INTO public.branch_memberships (user_id, branch_id, role)
        VALUES (v_caller_id, v_branch_id, COALESCE(v_profile.role, 'owner'))
        ON CONFLICT (user_id, branch_id) DO NOTHING;
        RETURN v_branch_id;
    END IF;

    -- Create new default branch for the authenticated user
    v_branch_name := COALESCE(NULLIF(TRIM(v_profile.business_name), ''), 'Main Branch');

    INSERT INTO public.branches (id, name, address, phone, is_main, created_by)
    VALUES (gen_random_uuid(), v_branch_name, v_profile.address, v_profile.phone, true, v_caller_id)
    RETURNING id INTO v_branch_id;

    UPDATE public.profiles
    SET branch_id = v_branch_id, updated_at = timezone('utc'::text, now())
    WHERE id = v_caller_id;

    INSERT INTO public.branch_memberships (user_id, branch_id, role)
    VALUES (v_caller_id, v_branch_id, 'owner')
    ON CONFLICT (user_id, branch_id) DO UPDATE SET role = 'owner';

    RETURN v_branch_id;
END;
$$;

-- J. Secure cancel_sale_and_restore_stock: branch-authorized atomic cancellation
CREATE OR REPLACE FUNCTION public.cancel_sale_and_restore_stock(p_sale_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_sale RECORD;
    v_item RECORD;
    v_has_permission BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    -- Verify sale exists
    SELECT id, user_id, branch_id INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found: %', p_sale_id;
    END IF;

    -- Validate branch membership: Caller must have membership in this sale's branch
    IF v_sale.branch_id IS NOT NULL THEN
        IF NOT public.has_branch_membership(v_sale.branch_id) THEN
            RAISE EXCEPTION 'Permission denied: Caller does not belong to the sale branch.';
        END IF;

        -- Caller must be manager/owner of the branch OR the employee who made the sale
        v_has_permission := public.is_branch_manager_or_above(v_sale.branch_id) OR (v_sale.user_id = v_caller_id);
    ELSE
        -- Fallback if legacy record had null branch_id: caller must own the sale
        v_has_permission := (v_sale.user_id = v_caller_id);
    END IF;

    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'Permission denied: Insufficient privileges to cancel this sale.';
    END IF;

    -- Atomically restore product stock for each line item within the same branch
    FOR v_item IN
        SELECT product_id, quantity
        FROM public.sale_items
        WHERE sale_id = p_sale_id AND product_id IS NOT NULL
    LOOP
        UPDATE public.products
        SET stock = stock + v_item.quantity,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_item.product_id
          AND (branch_id = v_sale.branch_id OR (v_sale.branch_id IS NULL AND user_id = v_sale.user_id));
    END LOOP;

    -- Delete parent sale (CASCADE deletes sale_items and sale_payments)
    DELETE FROM public.sales
    WHERE id = p_sale_id;

    RETURN TRUE;
END;
$$;

-- K. Secure handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pin TEXT;
    v_business TEXT;
    v_owner TEXT;
    v_branch_id UUID;
BEGIN
    v_pin := NULLIF(TRIM(NEW.raw_user_meta_data->>'manager_pin'), '');
    v_business := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), 'Bakery Store');
    v_owner := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), ''), v_business);

    IF v_pin IS NULL OR NOT (v_pin ~ '^[0-9]{4,6}$') THEN
        RAISE EXCEPTION 'A valid 4 to 6 digit manager_pin is required during account registration.';
    END IF;

    -- Create default branch for new user
    INSERT INTO public.branches (id, name, address, phone, is_main, created_by)
    VALUES (
        gen_random_uuid(),
        v_business,
        NEW.raw_user_meta_data->>'address',
        NEW.raw_user_meta_data->>'phone',
        true,
        NEW.id
    ) RETURNING id INTO v_branch_id;

    -- Insert profile linked to the new branch
    INSERT INTO public.profiles (
        id,
        email,
        username,
        business_name,
        owner_name,
        manager_pin,
        currency_symbol,
        branch_id,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1)),
        v_business,
        v_owner,
        v_pin,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'currency_symbol'), ''), '৳'),
        v_branch_id,
        'owner',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        branch_id = COALESCE(profiles.branch_id, EXCLUDED.branch_id),
        updated_at = timezone('utc'::text, now());

    -- Create owner membership in branch_memberships
    INSERT INTO public.branch_memberships (user_id, branch_id, role)
    VALUES (NEW.id, v_branch_id, 'owner')
    ON CONFLICT (user_id, branch_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. DATABASE INTEGRITY TRIGGERS: Anti-Privilege Escalation & Branch Tampering
-- ----------------------------------------------------------------------------

-- Prevent users from escalating their own role or switching to unauthorized branch
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Prevent self-role modification through client updates
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id THEN
            RAISE EXCEPTION 'Permission denied: Users cannot alter their own security role.';
        END IF;
    END IF;

    -- Prevent setting branch_id to a branch where user has no membership
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        IF NEW.branch_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.branch_memberships
                WHERE user_id = OLD.id AND branch_id = NEW.branch_id
            ) AND NOT EXISTS (
                SELECT 1 FROM public.branches
                WHERE id = NEW.branch_id AND created_by = auth.uid()
            ) THEN
                RAISE EXCEPTION 'Permission denied: Cannot switch to an unauthorized branch.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_security_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_security_fields();

-- Enforce branch integrity on operational records
CREATE OR REPLACE FUNCTION public.enforce_operational_branch_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_default_branch UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ensure user_id matches caller
    IF TG_OP = 'INSERT' THEN
        NEW.user_id := COALESCE(NEW.user_id, v_caller_id);

        -- If branch_id is null, resolve from user profile or memberships
        IF NEW.branch_id IS NULL THEN
            SELECT branch_id INTO v_default_branch
            FROM public.profiles WHERE id = v_caller_id;

            IF v_default_branch IS NULL THEN
                SELECT branch_id INTO v_default_branch
                FROM public.branch_memberships WHERE user_id = v_caller_id
                LIMIT 1;
            END IF;

            NEW.branch_id := v_default_branch;
        END IF;

        -- Verify caller is authorized for the target branch
        IF NEW.branch_id IS NOT NULL AND NOT public.has_branch_membership(NEW.branch_id) THEN
            RAISE EXCEPTION 'Permission denied: Caller is not a member of target branch.';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Prevent changing branch_id on an existing record
        IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
            RAISE EXCEPTION 'Permission denied: Modifying branch_id of existing records is prohibited.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach operational integrity trigger to all branch-scoped tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'products', 'sales', 'expenses', 'wastage', 'staff', 
        'attendance', 'deductions', 'daily_closings', 'monthly_closings', 
        'production', 'daily_notes'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_operational_branch_integrity ON public.%I;
            CREATE TRIGGER trg_operational_branch_integrity
                BEFORE INSERT OR UPDATE ON public.%I
                FOR EACH ROW
                EXECUTE FUNCTION public.enforce_operational_branch_integrity();
        ', tbl, tbl);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. DROP ALL INSECURE / CONFLICTING POLICIES (From both 001-005 and 20260906000000)
-- ----------------------------------------------------------------------------
-- Branches
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
DROP POLICY IF EXISTS "branches_select_member_or_admin" ON public.branches;
DROP POLICY IF EXISTS "branches_insert_admin" ON public.branches;
DROP POLICY IF EXISTS "branches_update_admin" ON public.branches;
DROP POLICY IF EXISTS "branches_delete_admin" ON public.branches;

-- Branch memberships
DROP POLICY IF EXISTS "memberships_select_own_or_admin" ON public.branch_memberships;
DROP POLICY IF EXISTS "memberships_insert_admin" ON public.branch_memberships;
DROP POLICY IF EXISTS "memberships_update_admin" ON public.branch_memberships;
DROP POLICY IF EXISTS "memberships_delete_admin" ON public.branch_memberships;

-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Products
DROP POLICY IF EXISTS "Users manage their own products" ON public.products;
DROP POLICY IF EXISTS "products_select_branch" ON public.products;
DROP POLICY IF EXISTS "products_insert_branch" ON public.products;
DROP POLICY IF EXISTS "products_update_branch" ON public.products;
DROP POLICY IF EXISTS "products_delete_branch" ON public.products;

-- Sales
DROP POLICY IF EXISTS "Users manage their own sales" ON public.sales;
DROP POLICY IF EXISTS "sales_select_branch" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_branch" ON public.sales;
DROP POLICY IF EXISTS "sales_update_branch" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_branch" ON public.sales;

-- Sale items
DROP POLICY IF EXISTS "Users manage sale items of their sales" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_select_branch" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert_branch" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete_branch" ON public.sale_items;

-- Sale payments
DROP POLICY IF EXISTS "Users manage payments of their sales" ON public.sale_payments;
DROP POLICY IF EXISTS "sale_payments_select_branch" ON public.sale_payments;
DROP POLICY IF EXISTS "sale_payments_insert_branch" ON public.sale_payments;
DROP POLICY IF EXISTS "sale_payments_delete_branch" ON public.sale_payments;

-- Expenses
DROP POLICY IF EXISTS "Users manage their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_branch" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_branch" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_branch" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_branch" ON public.expenses;

-- Wastage
DROP POLICY IF EXISTS "Users manage their own wastage" ON public.wastage;
DROP POLICY IF EXISTS "wastage_select_branch" ON public.wastage;
DROP POLICY IF EXISTS "wastage_insert_branch" ON public.wastage;
DROP POLICY IF EXISTS "wastage_delete_branch" ON public.wastage;

-- Staff
DROP POLICY IF EXISTS "Users manage their own staff" ON public.staff;
DROP POLICY IF EXISTS "staff_select_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_insert_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_update_branch" ON public.staff;
DROP POLICY IF EXISTS "staff_delete_branch" ON public.staff;

-- Attendance
DROP POLICY IF EXISTS "Users manage their own attendance records" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_branch" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_branch" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_branch" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_branch" ON public.attendance;

-- Deductions
DROP POLICY IF EXISTS "Users manage their own deductions" ON public.deductions;
DROP POLICY IF EXISTS "deductions_select_branch" ON public.deductions;
DROP POLICY IF EXISTS "deductions_insert_branch" ON public.deductions;
DROP POLICY IF EXISTS "deductions_delete_branch" ON public.deductions;

-- Daily closings
DROP POLICY IF EXISTS "Users manage their own daily closings" ON public.daily_closings;
DROP POLICY IF EXISTS "daily_closings_select_branch" ON public.daily_closings;
DROP POLICY IF EXISTS "daily_closings_insert_branch" ON public.daily_closings;
DROP POLICY IF EXISTS "daily_closings_update_branch" ON public.daily_closings;
DROP POLICY IF EXISTS "daily_closings_delete_branch" ON public.daily_closings;

-- Monthly closings
DROP POLICY IF EXISTS "Users manage their own monthly closings" ON public.monthly_closings;
DROP POLICY IF EXISTS "monthly_closings_select_branch" ON public.monthly_closings;
DROP POLICY IF EXISTS "monthly_closings_insert_branch" ON public.monthly_closings;
DROP POLICY IF EXISTS "monthly_closings_delete_branch" ON public.monthly_closings;

-- Production
DROP POLICY IF EXISTS "Users manage their own production" ON public.production;
DROP POLICY IF EXISTS "production_select_branch" ON public.production;
DROP POLICY IF EXISTS "production_insert_branch" ON public.production;
DROP POLICY IF EXISTS "production_delete_branch" ON public.production;

-- Daily notes
DROP POLICY IF EXISTS "Users manage their own daily notes" ON public.daily_notes;
DROP POLICY IF EXISTS "daily_notes_select_branch" ON public.daily_notes;
DROP POLICY IF EXISTS "daily_notes_insert_branch" ON public.daily_notes;
DROP POLICY IF EXISTS "daily_notes_update_branch" ON public.daily_notes;
DROP POLICY IF EXISTS "daily_notes_delete_branch" ON public.daily_notes;

-- ----------------------------------------------------------------------------
-- 6. STRICT MULTI-BRANCH & ROLE-BASED RLS POLICIES
-- ----------------------------------------------------------------------------

-- A. BRANCHES: No information leaks; users view only their authorized branches
CREATE POLICY "branches_select_policy"
    ON public.branches FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR id IN (
            SELECT bm.branch_id FROM public.branch_memberships bm
            WHERE bm.user_id = auth.uid()
        )
    );

CREATE POLICY "branches_insert_policy"
    ON public.branches FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (created_by = auth.uid() OR created_by IS NULL)
    );

CREATE POLICY "branches_update_policy"
    ON public.branches FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR public.is_branch_admin(id)
    )
    WITH CHECK (
        created_by = auth.uid()
        OR public.is_branch_admin(id)
    );

CREATE POLICY "branches_delete_policy"
    ON public.branches FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
    );

-- B. BRANCH MEMBERSHIPS: Scoped strictly to branch administrators and owners
CREATE POLICY "memberships_select_policy"
    ON public.branch_memberships FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_branch_admin(branch_id)
        OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_memberships.branch_id AND b.created_by = auth.uid())
    );

CREATE POLICY "memberships_insert_policy"
    ON public.branch_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_admin(branch_id)
        OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_memberships.branch_id AND b.created_by = auth.uid())
    );

CREATE POLICY "memberships_update_policy"
    ON public.branch_memberships FOR UPDATE
    TO authenticated
    USING (
        public.is_branch_admin(branch_id)
        OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_memberships.branch_id AND b.created_by = auth.uid())
    )
    WITH CHECK (
        public.is_branch_admin(branch_id)
        OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_memberships.branch_id AND b.created_by = auth.uid())
    );

CREATE POLICY "memberships_delete_policy"
    ON public.branch_memberships FOR DELETE
    TO authenticated
    USING (
        public.is_branch_admin(branch_id)
        OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = branch_memberships.branch_id AND b.created_by = auth.uid())
    );

-- C. PROFILES
CREATE POLICY "profiles_select_policy"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 
            FROM public.branch_memberships bm1
            JOIN public.branch_memberships bm2 ON bm1.branch_id = bm2.branch_id
            WHERE bm1.user_id = auth.uid() AND bm2.user_id = profiles.id
        )
    );

CREATE POLICY "profiles_insert_policy"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- D. PRODUCTS
CREATE POLICY "products_select_policy"
    ON public.products FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "products_insert_policy"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "products_update_policy"
    ON public.products FOR UPDATE
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "products_delete_policy"
    ON public.products FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- E. SALES
CREATE POLICY "sales_select_policy"
    ON public.sales FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "sales_insert_policy"
    ON public.sales FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "sales_update_policy"
    ON public.sales FOR UPDATE
    TO authenticated
    USING (
        (public.has_branch_membership(branch_id) AND (public.is_branch_manager_or_above(branch_id) OR user_id = auth.uid()))
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        (public.has_branch_membership(branch_id) AND (public.is_branch_manager_or_above(branch_id) OR user_id = auth.uid()))
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "sales_delete_policy"
    ON public.sales FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- F. SALE ITEMS
CREATE POLICY "sale_items_all_policy"
    ON public.sale_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
              AND (public.has_branch_membership(s.branch_id) OR (s.branch_id IS NULL AND s.user_id = auth.uid()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
              AND (public.has_branch_membership(s.branch_id) OR (s.branch_id IS NULL AND s.user_id = auth.uid()))
        )
    );

-- G. SALE PAYMENTS
CREATE POLICY "sale_payments_all_policy"
    ON public.sale_payments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_payments.sale_id
              AND (public.has_branch_membership(s.branch_id) OR (s.branch_id IS NULL AND s.user_id = auth.uid()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_payments.sale_id
              AND (public.has_branch_membership(s.branch_id) OR (s.branch_id IS NULL AND s.user_id = auth.uid()))
        )
    );

-- H. EXPENSES (Restricted: Cashiers cannot delete/update; Managers/Owners manage)
CREATE POLICY "expenses_select_policy"
    ON public.expenses FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "expenses_insert_policy"
    ON public.expenses FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "expenses_update_policy"
    ON public.expenses FOR UPDATE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "expenses_delete_policy"
    ON public.expenses FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- I. WASTAGE
CREATE POLICY "wastage_select_policy"
    ON public.wastage FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "wastage_insert_policy"
    ON public.wastage FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "wastage_delete_policy"
    ON public.wastage FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- J. STAFF (Manager/Owner only for write operations)
CREATE POLICY "staff_select_policy"
    ON public.staff FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "staff_insert_policy"
    ON public.staff FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "staff_update_policy"
    ON public.staff FOR UPDATE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "staff_delete_policy"
    ON public.staff FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- K. ATTENDANCE
CREATE POLICY "attendance_select_policy"
    ON public.attendance FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "attendance_insert_policy"
    ON public.attendance FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "attendance_update_policy"
    ON public.attendance FOR UPDATE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "attendance_delete_policy"
    ON public.attendance FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- L. DEDUCTIONS (Manager/Owner only)
CREATE POLICY "deductions_select_policy"
    ON public.deductions FOR SELECT
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "deductions_insert_policy"
    ON public.deductions FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "deductions_delete_policy"
    ON public.deductions FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- M. DAILY CLOSINGS (Manager/Owner only for write/delete)
CREATE POLICY "daily_closings_select_policy"
    ON public.daily_closings FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "daily_closings_insert_policy"
    ON public.daily_closings FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "daily_closings_update_policy"
    ON public.daily_closings FOR UPDATE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "daily_closings_delete_policy"
    ON public.daily_closings FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- N. MONTHLY CLOSINGS (Manager/Owner only for write/delete)
CREATE POLICY "monthly_closings_select_policy"
    ON public.monthly_closings FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "monthly_closings_insert_policy"
    ON public.monthly_closings FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "monthly_closings_delete_policy"
    ON public.monthly_closings FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- O. PRODUCTION
CREATE POLICY "production_select_policy"
    ON public.production FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "production_insert_policy"
    ON public.production FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "production_delete_policy"
    ON public.production FOR DELETE
    TO authenticated
    USING (
        public.is_branch_manager_or_above(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

-- P. DAILY NOTES
CREATE POLICY "daily_notes_select_policy"
    ON public.daily_notes FOR SELECT
    TO authenticated
    USING (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "daily_notes_insert_policy"
    ON public.daily_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_branch_membership(branch_id)
        OR (branch_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "daily_notes_update_policy"
    ON public.daily_notes FOR UPDATE
    TO authenticated
    USING (
        public.has_branch_membership(branch_id) AND (
            author = auth.uid()::text 
            OR user_id = auth.uid() 
            OR public.is_branch_manager_or_above(branch_id)
        )
    )
    WITH CHECK (
        public.has_branch_membership(branch_id) AND (
            author = auth.uid()::text 
            OR user_id = auth.uid() 
            OR public.is_branch_manager_or_above(branch_id)
        )
    );

CREATE POLICY "daily_notes_delete_policy"
    ON public.daily_notes FOR DELETE
    TO authenticated
    USING (
        public.has_branch_membership(branch_id) AND (
            author = auth.uid()::text 
            OR user_id = auth.uid() 
            OR public.is_branch_manager_or_above(branch_id)
        )
    );

-- ----------------------------------------------------------------------------
-- 7. REVOKE UNNECESSARY PRIVILEGES & GRANT MINIMUM LEAST-PRIVILEGE ACCESS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_branch_membership(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_branch_role(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_branch_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_branch_manager_or_above(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_branch_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_branch_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_default_branch(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_sale_and_restore_stock(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_operational_branch_integrity() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_branch_membership(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_branch_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_branch_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_branch_manager_or_above(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_branch_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_branch_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_default_branch(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_sale_and_restore_stock(TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. PERFORMANCE INDEXES FOR BRANCH & MEMBERSHIP FILTERING
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_branch_memberships_user_branch ON public.branch_memberships(user_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_memberships_branch_user ON public.branch_memberships(branch_id, user_id);
CREATE INDEX IF NOT EXISTS idx_branches_created_by ON public.branches(created_by);

CREATE INDEX IF NOT EXISTS idx_products_branch ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_wastage_branch ON public.wastage(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON public.staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance(branch_id);
CREATE INDEX IF NOT EXISTS idx_deductions_branch ON public.deductions(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_branch ON public.daily_closings(branch_id);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_branch ON public.monthly_closings(branch_id);
CREATE INDEX IF NOT EXISTS idx_production_branch ON public.production(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_branch ON public.daily_notes(branch_id);
