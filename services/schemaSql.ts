export const SETUP_SCHEMA_SQL = `-- ============================================================================
-- BAKERY & SWEET SHOP MANAGEMENT SYSTEM - COMPLETE IDEMPOTENT DATABASE SCHEMA
-- Target Database: Supabase PostgreSQL (public schema)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Branches
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

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    business_name TEXT NOT NULL DEFAULT 'Sweet Live Bakery',
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    manager_pin TEXT NOT NULL DEFAULT '1234' CHECK (manager_pin ~ '^[0-9]{4,6}$'),
    currency_symbol TEXT DEFAULT '৳',
    receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMPTZ
);

-- Branch Memberships
CREATE TABLE IF NOT EXISTS public.branch_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'staff', 'user')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, branch_id)
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pcs',
    barcode TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Mobile Payment')),
    mobile_provider TEXT CHECK (mobile_provider IS NULL OR mobile_provider IN ('Bkash', 'Nagad', 'Rocket', 'Other')),
    transaction_id TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'pcs',
    price_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sub_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sale Payments
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'Mobile Payment')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    category TEXT NOT NULL CHECK (category IN ('Raw Material', 'Utilities', 'Rent', 'Staff', 'Salary', 'Other')),
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Wastage
CREATE TABLE IF NOT EXISTS public.wastage (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Staff
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Late', 'Absent')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_staff_date_per_user UNIQUE (user_id, staff_id, date)
);

-- Deductions
CREATE TABLE IF NOT EXISTS public.deductions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    reason TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily Closings
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Monthly Closings
CREATE TABLE IF NOT EXISTS public.monthly_closings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Production
CREATE TABLE IF NOT EXISTS public.production (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily Notes
CREATE TABLE IF NOT EXISTS public.daily_notes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'info')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    assigned_to TEXT,
    author TEXT NOT NULL,
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_branch ON public.products(user_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.sales(user_id, date);
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

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

-- Helper RPC
CREATE OR REPLACE FUNCTION public.ensure_default_branch(p_user_email TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_branch_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND p_user_email IS NOT NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_user_email)) LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT branch_id INTO v_branch_id FROM public.branch_memberships WHERE user_id = v_user_id LIMIT 1;
    IF v_branch_id IS NOT NULL THEN
        RETURN v_branch_id;
    END IF;

    SELECT id INTO v_branch_id FROM public.branches WHERE is_main = true LIMIT 1;
    IF v_branch_id IS NULL THEN
        INSERT INTO public.branches (name, code, is_main, created_by)
        VALUES ('Main Branch', 'HQ', true, v_user_id)
        RETURNING id INTO v_branch_id;
    END IF;

    INSERT INTO public.branch_memberships (user_id, branch_id, role)
    VALUES (v_user_id, v_branch_id, 'owner')
    ON CONFLICT (user_id, branch_id) DO NOTHING;

    UPDATE public.profiles SET branch_id = v_branch_id WHERE id = v_user_id AND branch_id IS NULL;

    RETURN v_branch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_branch(TEXT) TO authenticated, anon;

-- Policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
    CREATE POLICY "Authenticated users can view branches" ON public.branches FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated users can insert branches" ON public.branches;
    CREATE POLICY "Authenticated users can insert branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Members can view their memberships" ON public.branch_memberships;
    CREATE POLICY "Members can view their memberships" ON public.branch_memberships FOR SELECT TO authenticated USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can insert memberships" ON public.branch_memberships;
    CREATE POLICY "Users can insert memberships" ON public.branch_memberships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users manage products" ON public.products;
    CREATE POLICY "Users manage products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage sales" ON public.sales;
    CREATE POLICY "Users manage sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage sale items" ON public.sale_items;
    CREATE POLICY "Users manage sale items" ON public.sale_items FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid()));

    DROP POLICY IF EXISTS "Users manage sale payments" ON public.sale_payments;
    CREATE POLICY "Users manage sale payments" ON public.sale_payments FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_payments.sale_id AND s.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_payments.sale_id AND s.user_id = auth.uid()));

    DROP POLICY IF EXISTS "Users manage expenses" ON public.expenses;
    CREATE POLICY "Users manage expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage wastage" ON public.wastage;
    CREATE POLICY "Users manage wastage" ON public.wastage FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage staff" ON public.staff;
    CREATE POLICY "Users manage staff" ON public.staff FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage attendance" ON public.attendance;
    CREATE POLICY "Users manage attendance" ON public.attendance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage deductions" ON public.deductions;
    CREATE POLICY "Users manage deductions" ON public.deductions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage daily closings" ON public.daily_closings;
    CREATE POLICY "Users manage daily closings" ON public.daily_closings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage monthly closings" ON public.monthly_closings;
    CREATE POLICY "Users manage monthly closings" ON public.monthly_closings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage production" ON public.production;
    CREATE POLICY "Users manage production" ON public.production FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users manage daily notes" ON public.daily_notes;
    CREATE POLICY "Users manage daily notes" ON public.daily_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

END $$;

-- Minimal & Secure Production Grants for PostgREST & Supabase Roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Minimum required table privileges for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Full administrative privileges reserved exclusively for service_role and postgres
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- Maintain secure default privileges for newly created future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;

NOTIFY pgrst, 'reload schema';
`;
