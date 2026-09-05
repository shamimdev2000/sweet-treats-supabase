/*
# Extend Profiles + Branch Helper + Delete Wastage RPC

## Purpose
1. Adds business-related columns to profiles (business_name, owner_name, address, manager_pin, currency_symbol, receipt_footer)
2. Creates ensure_default_branch() function that auto-creates a branch + membership for users who don't have one
3. Creates delete_wastage() RPC that restores stock and deletes the wastage record atomically

## Modified Tables
### public.profiles — added columns:
- business_name (text) — bakery/store name
- owner_name (text) — owner display name
- address (text) — store address
- manager_pin (text, default '123456') — admin panel PIN
- currency_symbol (text, default '৳') — currency symbol for receipts
- receipt_footer (text) — receipt footer message

## New Functions
1. ensure_default_branch(p_user_email text) RETURNS uuid
   - Looks up the user's profile by email
   - If user has no branches, creates a default branch named after their business
   - Creates a branch_membership with role 'admin' (first user is admin of their own branch)
   - Returns the branch_id
   - SECURITY DEFINER, search_path = public

2. delete_wastage(p_branch_id uuid, p_wastage_id uuid) RETURNS json
   - Fetches the wastage record (quantity, product_id)
   - Restores stock to the product atomically (FOR UPDATE lock)
   - Deletes the wastage record
   - SECURITY DEFINER, search_path = public
*/

-- ============================================================================
-- ADD BUSINESS COLUMNS TO PROFILES
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'business_name') THEN
    ALTER TABLE public.profiles ADD COLUMN business_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'owner_name') THEN
    ALTER TABLE public.profiles ADD COLUMN owner_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
    ALTER TABLE public.profiles ADD COLUMN address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'manager_pin') THEN
    ALTER TABLE public.profiles ADD COLUMN manager_pin text NOT NULL DEFAULT '123456';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'currency_symbol') THEN
    ALTER TABLE public.profiles ADD COLUMN currency_symbol text NOT NULL DEFAULT '৳';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'receipt_footer') THEN
    ALTER TABLE public.profiles ADD COLUMN receipt_footer text;
  END IF;
END $$;

-- ============================================================================
-- FUNCTION: ensure_default_branch
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_default_branch(p_user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_branch_id uuid;
  v_branch_name text;
BEGIN
  -- Get the user's profile
  SELECT * INTO v_profile FROM public.profiles WHERE email = lower(trim(p_user_email));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for email: %', p_user_email;
  END IF;

  -- Check if user already has a branch
  SELECT bm.branch_id INTO v_branch_id
  FROM public.branch_memberships bm
  WHERE bm.user_id = v_profile.id
  LIMIT 1;

  IF v_branch_id IS NOT NULL THEN
    RETURN v_branch_id;
  END IF;

  -- Create a default branch
  v_branch_name := COALESCE(v_profile.business_name, v_profile.full_name, 'My Bakery');

  INSERT INTO public.branches (id, name, address, phone, created_by)
  VALUES (gen_random_uuid(), v_branch_name, v_profile.address, v_profile.phone, v_profile.id)
  RETURNING id INTO v_branch_id;

  -- Create membership with admin role (first user is admin of their own branch)
  INSERT INTO public.branch_memberships (user_id, branch_id, role)
  VALUES (v_profile.id, v_branch_id, 'admin');

  RETURN v_branch_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_branch(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_branch(text) TO authenticated;

-- ============================================================================
-- RPC: delete_wastage (restore stock + delete record)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_wastage(
  p_branch_id uuid,
  p_wastage_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wastage public.wastage;
  v_product public.products;
BEGIN
  -- Validate branch access
  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'Access denied: no membership for this branch';
  END IF;

  -- Lock and fetch wastage record
  SELECT * INTO v_wastage FROM public.wastage
  WHERE id = p_wastage_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wastage record not found';
  END IF;

  -- Lock product and restore stock
  SELECT * INTO v_product FROM public.products
  WHERE id = v_wastage.product_id AND branch_id = p_branch_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.products
    SET stock = stock + v_wastage.quantity, updated_at = now()
    WHERE id = v_wastage.product_id AND branch_id = p_branch_id;
  END IF;

  -- Delete wastage record
  DELETE FROM public.wastage WHERE id = p_wastage_id AND branch_id = p_branch_id;

  RETURN json_build_object('success', true, 'wastage_id', p_wastage_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_wastage(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_wastage(uuid, uuid) TO authenticated;
