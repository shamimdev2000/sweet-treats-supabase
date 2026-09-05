/*
# Products, Production, and Wastage

## Purpose
Creates the inventory, production, and wastage tables with branch-level isolation.
Stock is stored as a NUMERIC column on products and updated atomically via RPC functions.

## New Tables

### 1. public.products
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `name` (text, NOT NULL)
- `category` (text, NOT NULL, default 'Other')
- `price` (numeric(14,2), NOT NULL, default 0) — price per unit
- `stock` (numeric(14,3), NOT NULL, default 0) — current stock level
- `unit` (text, NOT NULL, default 'pcs') — e.g. 'pcs', 'kg', 'gm', 'pkt', 'ltr', 'box'
- `barcode` (text) — optional barcode
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- UNIQUE(branch_id, name) — product names unique within a branch
- CHECK: price >= 0, stock >= 0

### 2. public.production
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `product_id` (uuid, NOT NULL, references products.id, ON DELETE CASCADE)
- `product_name` (text, NOT NULL) — denormalized for reporting
- `quantity` (numeric(14,3), NOT NULL, CHECK > 0)
- `unit` (text, NOT NULL)
- `unit_price` (numeric(14,2), NOT NULL)
- `total_value` (numeric(14,2), NOT NULL) — quantity * unit_price
- `date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

### 3. public.wastage
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `product_id` (uuid, NOT NULL, references products.id, ON DELETE CASCADE)
- `product_name` (text, NOT NULL)
- `quantity` (numeric(14,3), NOT NULL, CHECK > 0)
- `unit` (text, NOT NULL)
- `loss_value` (numeric(14,2), NOT NULL) — price * quantity
- `reason` (text, NOT NULL, default 'Other')
- `date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)

## RPC Functions (SECURITY DEFINER, atomic transactions)

### 1. record_production(p_branch_id, p_product_id, p_quantity, p_unit_price)
- Inserts a production record
- Atomically increments product.stock by p_quantity
- Returns the new production row as JSON
- Validates branch access via has_branch_access()
- Prevents negative stock (CHECK constraint on products)

### 2. record_wastage(p_branch_id, p_product_id, p_quantity, p_reason)
- Inserts a wastage record
- Atomically decrements product.stock by p_quantity
- Prevents stock going negative (raises exception if insufficient)
- Returns the new wastage row as JSON
- Validates branch access

### 3. upsert_product(p_branch_id, p_product_id, p_name, p_category, p_price, p_stock, p_unit, p_barcode, p_add_stock)
- Upserts a product within a branch
- If p_product_id is null, creates new product
- If p_add_stock > 0, adds to existing stock (for production entries)
- Validates branch access

## RLS Policies
All tables use branch-scoped policies:
- SELECT/INSERT/UPDATE/DELETE only for users with branch access (or admin)
- branch_id is enforced server-side — client cannot inject arbitrary branch_id
*/

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unit text NOT NULL DEFAULT 'pcs',
  barcode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, name)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRODUCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  total_value numeric(14,2) NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- WASTAGE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wastage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  loss_value numeric(14,2) NOT NULL,
  reason text NOT NULL DEFAULT 'Other',
  date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RPC: record_production (atomic stock increment)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_production(
  p_branch_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_unit_price numeric(14,2);
  v_total_value numeric(14,2);
  v_new_id uuid := gen_random_uuid();
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  -- Lock the product row for atomic update
  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in this branch';
  END IF;

  v_unit_price := COALESCE(p_unit_price, v_product.price);
  v_total_value := ROUND(p_quantity * v_unit_price, 2);

  -- Insert production record
  INSERT INTO public.production (id, branch_id, product_id, product_name, quantity, unit, unit_price, total_value, date, created_by)
  VALUES (v_new_id, p_branch_id, p_product_id, v_product.name, p_quantity, v_product.unit, v_unit_price, v_total_value, now(), auth.uid());

  -- Atomically increment stock
  UPDATE public.products
  SET stock = stock + p_quantity, updated_at = now()
  WHERE id = p_product_id AND branch_id = p_branch_id;

  -- Return result
  SELECT json_build_object(
    'id', v_new_id,
    'branch_id', p_branch_id,
    'product_id', p_product_id,
    'product_name', v_product.name,
    'quantity', p_quantity,
    'unit', v_product.unit,
    'unit_price', v_unit_price,
    'total_value', v_total_value,
    'date', now(),
    'created_by', auth.uid()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_production(uuid, uuid, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_production(uuid, uuid, numeric, numeric) TO authenticated;

-- ============================================================================
-- RPC: record_wastage (atomic stock decrement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_wastage(
  p_branch_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text DEFAULT 'Other'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_loss_value numeric(14,2);
  v_new_id uuid := gen_random_uuid();
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  -- Lock the product row for atomic update
  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in this branch';
  END IF;

  -- Prevent negative stock
  IF v_product.stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_product.stock, p_quantity;
  END IF;

  v_loss_value := ROUND(v_product.price * p_quantity, 2);

  -- Insert wastage record
  INSERT INTO public.wastage (id, branch_id, product_id, product_name, quantity, unit, loss_value, reason, date, created_by)
  VALUES (v_new_id, p_branch_id, p_product_id, v_product.name, p_quantity, v_product.unit, v_loss_value, p_reason, now(), auth.uid());

  -- Atomically decrement stock
  UPDATE public.products
  SET stock = stock - p_quantity, updated_at = now()
  WHERE id = p_product_id AND branch_id = p_branch_id;

  SELECT json_build_object(
    'id', v_new_id,
    'branch_id', p_branch_id,
    'product_id', p_product_id,
    'product_name', v_product.name,
    'quantity', p_quantity,
    'unit', v_product.unit,
    'loss_value', v_loss_value,
    'reason', p_reason,
    'date', now(),
    'created_by', auth.uid()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_wastage(uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_wastage(uuid, uuid, numeric, text) TO authenticated;

-- ============================================================================
-- RPC: upsert_product
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_product(
  p_branch_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_category text DEFAULT 'Other',
  p_price numeric DEFAULT 0,
  p_stock numeric DEFAULT 0,
  p_unit text DEFAULT 'pcs',
  p_barcode text DEFAULT NULL,
  p_add_stock numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_product_id, gen_random_uuid());
  v_existing public.products;
  v_final_stock numeric(14,3);
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  SELECT * INTO v_existing FROM public.products WHERE id = v_id AND branch_id = p_branch_id;

  IF FOUND THEN
    -- Update existing product
    v_final_stock := v_existing.stock + p_add_stock;
    UPDATE public.products
    SET name = p_name, category = p_category, price = p_price,
        stock = CASE WHEN p_add_stock > 0 THEN v_final_stock ELSE p_stock END,
        unit = p_unit, barcode = p_barcode, updated_at = now()
    WHERE id = v_id AND branch_id = p_branch_id
    RETURNING * INTO v_existing;
  ELSE
    -- Insert new product
    v_final_stock := p_stock;
    INSERT INTO public.products (id, branch_id, name, category, price, stock, unit, barcode)
    VALUES (v_id, p_branch_id, p_name, p_category, p_price, p_stock, p_unit, p_barcode)
    RETURNING * INTO v_existing;
  END IF;

  SELECT json_build_object(
    'id', v_existing.id,
    'branch_id', v_existing.branch_id,
    'name', v_existing.name,
    'category', v_existing.category,
    'price', v_existing.price,
    'stock', v_existing.stock,
    'unit', v_existing.unit,
    'barcode', v_existing.barcode
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_product(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_product(uuid, uuid, text, text, numeric, numeric, text, text, numeric) TO authenticated;

-- ============================================================================
-- RLS POLICIES: PRODUCTS
-- ============================================================================
DROP POLICY IF EXISTS "products_select_branch" ON public.products;
CREATE POLICY "products_select_branch"
ON public.products FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "products_insert_branch" ON public.products;
CREATE POLICY "products_insert_branch"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "products_update_branch" ON public.products;
CREATE POLICY "products_update_branch"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "products_delete_branch" ON public.products;
CREATE POLICY "products_delete_branch"
ON public.products FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: PRODUCTION
-- ============================================================================
DROP POLICY IF EXISTS "production_select_branch" ON public.production;
CREATE POLICY "production_select_branch"
ON public.production FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "production_insert_branch" ON public.production;
CREATE POLICY "production_insert_branch"
ON public.production FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "production_delete_branch" ON public.production;
CREATE POLICY "production_delete_branch"
ON public.production FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: WASTAGE
-- ============================================================================
DROP POLICY IF EXISTS "wastage_select_branch" ON public.wastage;
CREATE POLICY "wastage_select_branch"
ON public.wastage FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "wastage_insert_branch" ON public.wastage;
CREATE POLICY "wastage_insert_branch"
ON public.wastage FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "wastage_delete_branch" ON public.wastage;
CREATE POLICY "wastage_delete_branch"
ON public.wastage FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.production TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.wastage TO authenticated;
