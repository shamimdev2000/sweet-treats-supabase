/*
# Fix: Revoke PUBLIC execute on SECURITY DEFINER functions

## Purpose
The previous REVOKE FROM anon didn't work because the functions were granted to
PUBLIC (which includes anon). This migration revokes from PUBLIC and then
re-grants only to authenticated.

## Security Changes
- REVOKE EXECUTE FROM PUBLIC on all SECURITY DEFINER functions
- GRANT EXECUTE TO authenticated only
*/

REVOKE EXECUTE ON FUNCTION public.has_branch_access(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_branch_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_default_branch(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_production(uuid, uuid, numeric, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_wastage(uuid, uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_product(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_wastage(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid, json, numeric, numeric, numeric, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.collect_due_payment(uuid, uuid, numeric, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_branch_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_branch_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_branch(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_production(uuid, uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_wastage(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_product(uuid, uuid, text, text, numeric, numeric, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_wastage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, json, numeric, numeric, numeric, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_due_payment(uuid, uuid, numeric, text, text, text) TO authenticated;
