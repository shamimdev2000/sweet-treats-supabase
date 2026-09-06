-- ============================================================================
-- Supabase Schema Migration: Bakery Management System (Multi-tenant & Multi-branch)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRANCHES (Multi-branch support)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USER PROFILES (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    business_name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    manager_pin TEXT NOT NULL CHECK (manager_pin ~ '^[0-9]{4,6}$'),
    currency_symbol TEXT DEFAULT '৳',
    receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMPTZ
);

-- 3. PRODUCTS / INVENTORY
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

-- 4. SALES
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

-- 5. SALE ITEMS (Items in each receipt)
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

-- 6. SALE PAYMENTS (Partial and due repayment transactions)
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'Mobile Payment')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EXPENSES
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

-- 8. WASTAGE
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

-- 9. STAFF
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

-- 10. ATTENDANCE
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

-- 11. DEDUCTIONS / ADVANCE SALARY
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

-- 12. DAILY CLOSING
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

-- 13. MONTHLY CLOSING
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

-- 14. PRODUCTION LOGS
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

-- 15. DAILY NOTES
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

-- ============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_name, customer_phone);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_wastage_user ON public.wastage(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_deductions_user ON public.deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_user ON public.daily_closings(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_closings_user ON public.monthly_closings(user_id);
CREATE INDEX IF NOT EXISTS idx_production_user ON public.production(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_notes_user ON public.daily_notes(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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

-- Branches policy (authenticated users can view branches)
CREATE POLICY "Authenticated users can view branches"
    ON public.branches FOR SELECT
    TO authenticated
    USING (true);

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Macro policies for user_id owned tables:
-- Products
CREATE POLICY "Users manage their own products"
    ON public.products FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Sales
CREATE POLICY "Users manage their own sales"
    ON public.sales FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Sale Items (linked via sale_id to a user's sale)
CREATE POLICY "Users manage sale items of their sales"
    ON public.sale_items FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid()));

-- Sale Payments (linked via sale_id to a user's sale)
CREATE POLICY "Users manage payments of their sales"
    ON public.sale_payments FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_payments.sale_id AND sales.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_payments.sale_id AND sales.user_id = auth.uid()));

-- Expenses
CREATE POLICY "Users manage their own expenses"
    ON public.expenses FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Wastage
CREATE POLICY "Users manage their own wastage"
    ON public.wastage FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Staff
CREATE POLICY "Users manage their own staff"
    ON public.staff FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Attendance
CREATE POLICY "Users manage their own attendance records"
    ON public.attendance FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Deductions
CREATE POLICY "Users manage their own deductions"
    ON public.deductions FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Daily Closings
CREATE POLICY "Users manage their own daily closings"
    ON public.daily_closings FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Monthly Closings
CREATE POLICY "Users manage their own monthly closings"
    ON public.monthly_closings FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Production
CREATE POLICY "Users manage their own production"
    ON public.production FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Daily Notes
CREATE POLICY "Users manage their own daily notes"
    ON public.daily_notes FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- AUTH TRIGGER: Automatically handle new users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_pin TEXT;
    v_business TEXT;
    v_owner TEXT;
BEGIN
    v_pin := NULLIF(TRIM(NEW.raw_user_meta_data->>'manager_pin'), '');
    v_business := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), 'Bakery Store');
    v_owner := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), ''), v_business);

    -- Enforce that a valid 4 to 6 digit manager PIN was supplied by the registering user
    IF v_pin IS NULL OR NOT (v_pin ~ '^[0-9]{4,6}$') THEN
        RAISE EXCEPTION 'A valid 4 to 6 digit manager_pin is required during account registration.';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        username,
        business_name,
        owner_name,
        manager_pin,
        currency_symbol,
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
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ATOMIC TRANSACTIONAL FUNCTION: Cancel Sale & Restore Stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_sale_and_restore_stock(p_sale_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_user_id UUID;
BEGIN
    -- Verify sale exists and belongs to the authenticated user
    SELECT user_id INTO v_user_id
    FROM public.sales
    WHERE id = p_sale_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found or unauthorized to cancel this transaction.';
    END IF;

    -- Atomically restore product stock for each line item in this sale
    FOR v_item IN
        SELECT product_id, quantity
        FROM public.sale_items
        WHERE sale_id = p_sale_id AND product_id IS NOT NULL
    LOOP
        UPDATE public.products
        SET stock = stock + v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.product_id AND user_id = auth.uid();
    END LOOP;

    -- Delete parent sale (FOREIGN KEY ON DELETE CASCADE cleans sale_items and sale_payments)
    DELETE FROM public.sales
    WHERE id = p_sale_id AND user_id = auth.uid();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
