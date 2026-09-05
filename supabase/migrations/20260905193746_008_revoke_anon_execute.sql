/*
# Fix: Revoke anon execute on all SECURITY DEFINER functions

## Purpose
The Supabase security advisor detected that the `anon` role can still execute
SECURITY DEFINER functions via the REST API. This migration explicitly revokes
EXECUTE from `anon` on all SECURITY DEFINER functions to ensure only authenticated
users can call them.

## Security Changes
- REVOKE EXECUTE FROM anon on all RPC functions:
  - has_branch_access
  - user_role
  - is_admin
  - user_branch_ids
  - handle_new_user
  - ensure_default_branch
  - record_production
  - record_wastage
  - upsert_product
  - delete_wastage
  - create_sale
  - cancel_sale
  - collect_due_payment
*/

REVOKE EXECUTE ON FUNCTION public.has_branch_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_branch_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_default_branch(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_production(uuid, uuid, numeric, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_wastage(uuid, uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_product(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_wastage(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid, json, numeric, numeric, numeric, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.collect_due_payment(uuid, uuid, numeric, text, text, text) FROM anon;
