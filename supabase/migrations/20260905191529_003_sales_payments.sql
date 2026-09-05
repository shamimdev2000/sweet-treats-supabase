/*
# Sales, Sale Items, and Payments

## Purpose
Creates the sales subsystem with atomic sale creation that deducts inventory in a single
transaction. Supports partial payments (dues) and multiple payment records per sale.

## New Tables

### 1. public.sales
- `id` (uuid, PK, default gen_random_uuid())
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `total_price` (numeric(14,2), NOT NULL, default 0) — total after discount
- `discount` (numeric(14,2), NOT NULL, default 0)
- `amount_paid` (numeric(14,2), NOT NULL, default 0)
- `due_amount` (numeric(14,2), NOT NULL, default 0)
- `customer_name` (text)
- `customer_phone` (text)
- `payment_method` (text, NOT NULL, default 'Cash') — 'Cash' or 'Mobile Payment'
- `mobile_provider` (text) — 'Bkash', 'Nagad', 'Rocket', 'Other'
- `transaction_id` (text)
- `date` (timestamptz, NOT NULL, default now())
- `created_by` (uuid, references profiles.id)
- CHECK: total_price >= 0, discount >= 0, amount_paid >= 0, due_amount >= 0

### 2. public.sale_items
- `id` (uuid, PK, default gen_random_uuid())
- `sale_id` (uuid, NOT NULL, references sales.id, ON DELETE CASCADE)
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `product_id` (uuid, NOT NULL, references products.id, ON DELETE CASCADE)
- `product_name` (text, NOT NULL)
- `quantity` (numeric(14,3), NOT NULL, CHECK > 0)
- `unit` (text, NOT NULL)
- `price_per_unit` (numeric(14,2), NOT NULL)
- `sub_total` (numeric(14,2), NOT NULL) — quantity * price_per_unit
- `category` (text) — denormalized product category for reporting

### 3. public.payments
- `id` (uuid, PK, default gen_random_uuid())
- `sale_id` (uuid, NOT NULL, references sales.id, ON DELETE CASCADE)
- `branch_id` (uuid, NOT NULL, references branches.id, ON DELETE CASCADE)
- `amount` (numeric(14,2), NOT NULL, CHECK > 0)
- `date` (timestamptz, NOT NULL, default now())
- `method` (text, NOT NULL) — 'Cash' or 'Mobile Payment'
- CHECK: amount > 0

## RPC Functions (SECURITY DEFINER, atomic transactions)

### 1. create_sale(p_branch_id, p_items, p_total_price, p_discount, p_amount_paid, p_payment_method, p_customer_name, p_customer_phone, p_mobile_provider, p_transaction_id)
- Creates sale + sale_items + initial payment atomically in one transaction
- Deducts stock for each product with FOR UPDATE locking
- Prevents negative stock (raises exception if any product has insufficient stock)
- p_items is a JSON array: [{product_id, product_name, quantity, unit, price_per_unit, sub_total, category}]
- Returns the new sale as JSON
- Validates branch access

### 2. cancel_sale(p_branch_id, p_sale_id)
- Restores stock for all items in a sale
- Deletes the sale (cascades to sale_items and payments)
- Validates branch access
- Returns success/failure JSON

### 3. collect_due_payment(p_branch_id, p_sale_id, p_amount, p_payment_method, p_mobile_provider, p_transaction_id)
- Adds a payment to an existing due sale
- Updates amount_paid and due_amount on the sale
- Returns updated sale as JSON

## RLS Policies
All tables use branch-scoped policies with has_branch_access() or is_admin().
*/

-- ============================================================================
-- SALES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  total_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
  customer_name text,
  customer_phone text,
  payment_method text NOT NULL DEFAULT 'Cash',
  mobile_provider text,
  transaction_id text,
  date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SALE ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  price_per_unit numeric(14,2) NOT NULL,
  sub_total numeric(14,2) NOT NULL,
  category text
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  date timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RPC: create_sale (atomic sale + stock deduction)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_sale(
  p_branch_id uuid,
  p_items json,
  p_total_price numeric,
  p_discount numeric DEFAULT 0,
  p_amount_paid numeric DEFAULT 0,
  p_payment_method text DEFAULT 'Cash',
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_mobile_provider text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid := gen_random_uuid();
  v_item json;
  v_product public.products;
  v_due numeric(14,2);
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  v_due := GREATEST(0, p_total_price - p_amount_paid);

  -- Insert the sale
  INSERT INTO public.sales (id, branch_id, total_price, discount, amount_paid, due_amount,
    customer_name, customer_phone, payment_method, mobile_provider, transaction_id, date, created_by)
  VALUES (v_sale_id, p_branch_id, p_total_price, p_discount, p_amount_paid, v_due,
    p_customer_name, p_customer_phone, p_payment_method, p_mobile_provider, p_transaction_id, now(), auth.uid());

  -- Insert initial payment if amount > 0
  IF p_amount_paid > 0 THEN
    INSERT INTO public.payments (sale_id, branch_id, amount, date, method)
    VALUES (v_sale_id, p_branch_id, p_amount_paid, now(), p_payment_method);
  END IF;

  -- Process each item: insert sale_item + deduct stock atomically
  FOR v_item IN SELECT * FROM json_array_elements(p_items)
  LOOP
    -- Lock product row
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in branch', v_item->>'product_id';
    END IF;

    IF v_product.stock < (v_item->>'quantity')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for %: available %, requested %',
        v_product.name, v_product.stock, (v_item->>'quantity')::numeric;
    END IF;

    -- Insert sale item
    INSERT INTO public.sale_items (sale_id, branch_id, product_id, product_name, quantity, unit, price_per_unit, sub_total, category)
    VALUES (
      v_sale_id, p_branch_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::numeric,
      v_item->>'unit',
      (v_item->>'price_per_unit')::numeric,
      (v_item->>'sub_total')::numeric,
      v_item->>'category'
    );

    -- Deduct stock
    UPDATE public.products
    SET stock = stock - (v_item->>'quantity')::numeric, updated_at = now()
    WHERE id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;
  END LOOP;

  SELECT json_build_object(
    'id', v_sale_id,
    'branch_id', p_branch_id,
    'total_price', p_total_price,
    'discount', p_discount,
    'amount_paid', p_amount_paid,
    'due_amount', v_due,
    'customer_name', p_customer_name,
    'customer_phone', p_customer_phone,
    'payment_method', p_payment_method,
    'mobile_provider', p_mobile_provider,
    'transaction_id', p_transaction_id,
    'date', now(),
    'created_by', auth.uid()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_sale(uuid, json, numeric, numeric, numeric, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, json, numeric, numeric, numeric, text, text, text, text, text) TO authenticated;

-- ============================================================================
-- RPC: cancel_sale (restore stock + delete sale)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_sale(
  p_branch_id uuid,
  p_sale_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.sale_items;
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  -- Verify sale belongs to branch
  IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND branch_id = p_branch_id) THEN
    RAISE EXCEPTION 'Sale not found in this branch';
  END IF;

  -- Restore stock for each item
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id AND branch_id = p_branch_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity, updated_at = now()
    WHERE id = v_item.product_id AND branch_id = p_branch_id;
  END LOOP;

  -- Delete the sale (cascades to sale_items and payments)
  DELETE FROM public.sales WHERE id = p_sale_id AND branch_id = p_branch_id;

  SELECT json_build_object('success', true, 'sale_id', p_sale_id) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid) TO authenticated;

-- ============================================================================
-- RPC: collect_due_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.collect_due_payment(
  p_branch_id uuid,
  p_sale_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'Cash',
  p_mobile_provider text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_new_paid numeric(14,2);
  v_new_due numeric(14,2);
  v_result json;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  -- Lock sale row
  SELECT * INTO v_sale FROM public.sales
  WHERE id = p_sale_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found in this branch';
  END IF;

  IF v_sale.due_amount <= 0 THEN
    RAISE EXCEPTION 'No due amount on this sale';
  END IF;

  v_new_paid := v_sale.amount_paid + p_amount;
  v_new_due := GREATEST(0, v_sale.total_price - v_new_paid);

  -- Insert payment record
  INSERT INTO public.payments (sale_id, branch_id, amount, date, method)
  VALUES (p_sale_id, p_branch_id, p_amount, now(), p_payment_method);

  -- Update sale
  UPDATE public.sales
  SET amount_paid = v_new_paid, due_amount = v_new_due,
      payment_method = p_payment_method,
      mobile_provider = COALESCE(p_mobile_provider, mobile_provider),
      transaction_id = COALESCE(p_transaction_id, transaction_id)
  WHERE id = p_sale_id AND branch_id = p_branch_id
  RETURNING * INTO v_sale;

  SELECT json_build_object(
    'id', v_sale.id,
    'total_price', v_sale.total_price,
    'amount_paid', v_sale.amount_paid,
    'due_amount', v_sale.due_amount
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.collect_due_payment(uuid, uuid, numeric, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.collect_due_payment(uuid, uuid, numeric, text, text, text) TO authenticated;

-- ============================================================================
-- RLS POLICIES: SALES
-- ============================================================================
DROP POLICY IF EXISTS "sales_select_branch" ON public.sales;
CREATE POLICY "sales_select_branch"
ON public.sales FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "sales_insert_branch" ON public.sales;
CREATE POLICY "sales_insert_branch"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "sales_update_branch" ON public.sales;
CREATE POLICY "sales_update_branch"
ON public.sales FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin())
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "sales_delete_branch" ON public.sales;
CREATE POLICY "sales_delete_branch"
ON public.sales FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: SALE_ITEMS
-- ============================================================================
DROP POLICY IF EXISTS "sale_items_select_branch" ON public.sale_items;
CREATE POLICY "sale_items_select_branch"
ON public.sale_items FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "sale_items_insert_branch" ON public.sale_items;
CREATE POLICY "sale_items_insert_branch"
ON public.sale_items FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "sale_items_delete_branch" ON public.sale_items;
CREATE POLICY "sale_items_delete_branch"
ON public.sale_items FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- RLS POLICIES: PAYMENTS
-- ============================================================================
DROP POLICY IF EXISTS "payments_select_branch" ON public.payments;
CREATE POLICY "payments_select_branch"
ON public.payments FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "payments_insert_branch" ON public.payments;
CREATE POLICY "payments_insert_branch"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id) OR public.is_admin());

DROP POLICY IF EXISTS "payments_delete_branch" ON public.payments;
CREATE POLICY "payments_delete_branch"
ON public.payments FOR DELETE
TO authenticated
USING (public.has_branch_access(branch_id) OR public.is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.payments TO authenticated;
