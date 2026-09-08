-- ============================================================================
-- BAKERY & SWEET SHOP MANAGEMENT SYSTEM - COMPLETE IDEMPOTENT DATABASE SCHEMA
-- Target Database: Supabase PostgreSQL (public schema)
-- Safe for execution: Uses IF NOT EXISTS, DO blocks, and non-destructive DDL
-- ============================================================================

-- Step 1: Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 3: Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    business_name TEXT NOT NULL DEFAULT 'Sweet Live Bakery',
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    manager_pin TEXT NOT NULL DEFAULT '1234',
    currency_symbol TEXT DEFAULT '৳',
    receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMPTZ
);

-- Step 4: Create Branch Memberships Table
CREATE TABLE IF NOT EXISTS public.branch_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, branch_id)
);

-- Step 5: Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    barcode TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 6: Create Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    mobile_provider TEXT,
    transaction_id TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 7: Create Sale Items Table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'pcs',
    price_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sub_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 8: Create Sale Payments Table
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    method TEXT NOT NULL DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 9: Create Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 10: Create Wastage Table
CREATE TABLE IF NOT EXISTS public.wastage (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    loss_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 11: Create Staff Table
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 12: Create Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 13: Create Deductions Table
CREATE TABLE IF NOT EXISTS public.deductions (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 14: Create Daily Closings Table
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cash_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cash_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_mobile_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_wastage NUMERIC(12, 2) NOT NULL DEFAULT 0,
    system_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 15: Create Monthly Closings Table
CREATE TABLE IF NOT EXISTS public.monthly_closings (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    month TEXT NOT NULL,
    total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cash_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_mobile_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_wastage NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_dues NUMERIC(12, 2) DEFAULT 0,
    closed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 16: Create Production Table
CREATE TABLE IF NOT EXISTS public.production (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 17: Create Daily Notes Table
CREATE TABLE IF NOT EXISTS public.daily_notes (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'active',
    assigned_to TEXT,
    author TEXT NOT NULL,
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Step 18: Safely Add user_email Column If Not Present
DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.wastage ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.deductions ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.monthly_closings ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.production ADD COLUMN IF NOT EXISTS user_email TEXT;
    ALTER TABLE public.daily_notes ADD COLUMN IF NOT EXISTS user_email TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 19: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_branch ON public.products(user_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_user_email ON public.products(user_email);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.sales(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_user_email ON public.sales(user_email);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_wastage_user ON public.wastage(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_deductions_user ON public.deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_user ON public.daily_closings(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_user ON public.monthly_closings(user_id);
CREATE INDEX IF NOT EXISTS idx_production_user ON public.production(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_user ON public.daily_notes(user_id);

-- Step 20: Helper Procedure for Inventory Restoration on Sale Cancellation
CREATE OR REPLACE FUNCTION public.cancel_sale_and_restore_stock(p_sale_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        IF r.product_id IS NOT NULL THEN
            UPDATE public.products 
            SET stock = stock + r.quantity, 
                updated_at = timezone('utc'::text, now())
            WHERE id = r.product_id;
        END IF;
    END LOOP;

    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$$;

-- Step 20b: Auto-create Profile and Default Branch on New Auth User Registration
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
    -- 1. Parse metadata with safe valid fallbacks (guarantees 4-6 digit numeric PIN)
    v_pin := NULLIF(TRIM(NEW.raw_user_meta_data->>'manager_pin'), '');
    IF v_pin IS NULL OR NOT (v_pin ~ '^[0-9]{4,6}$') THEN
        v_pin := '1234';
    END IF;

    v_business := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), 'Bakery Store');
    v_owner := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), ''), split_part(NEW.email, '@', 1));

    -- 2. Step 1 — Insert public.profiles FIRST
    -- (Satisfies foreign key constraint public.branches.created_by -> public.profiles.id)
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
        NULL,
        'owner',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

    -- 3. Step 2 — Create default branch after profile exists
    INSERT INTO public.branches (id, name, address, phone, is_main, created_by)
    VALUES (
        gen_random_uuid(),
        v_business,
        NEW.raw_user_meta_data->>'address',
        NEW.raw_user_meta_data->>'phone',
        true,
        NEW.id
    ) RETURNING id INTO v_branch_id;

    -- 4. Step 3 — Link Profile to newly created branch
    UPDATE public.profiles
    SET branch_id = v_branch_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.id;

    -- 5. Step 4 — Create user membership for the new branch using role 'admin'
    -- ('admin' strictly satisfies all existing branch_memberships role check constraints)
    INSERT INTO public.branch_memberships (user_id, branch_id, role)
    VALUES (NEW.id, v_branch_id, 'admin')
    ON CONFLICT (user_id, branch_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 21: Full Access Privileges for Application Roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- Step 22: Enable Row Level Security (RLS) with Permissive Policy for Bakery Operations
DO $$ 
DECLARE
    t text;
    tbls text[] := ARRAY[
        'branches', 'profiles', 'branch_memberships', 'products', 'sales',
        'sale_items', 'sale_payments', 'expenses', 'wastage', 'staff',
        'attendance', 'deductions', 'daily_closings', 'monthly_closings',
        'production', 'daily_notes'
    ];
BEGIN
    FOREACH t IN ARRAY tbls LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Public full access" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all for users" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Public full access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;

-- Step 23: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
