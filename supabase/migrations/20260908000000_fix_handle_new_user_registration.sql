-- ============================================================================
-- Migration: Fix Registration Persistence (handle_new_user)
-- Fixes circular insertion order: profiles -> branches -> link branch -> branch_memberships
-- ============================================================================

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

-- Ensure trigger is connected to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
