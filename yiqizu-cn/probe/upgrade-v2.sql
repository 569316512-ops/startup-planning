-- Existing probe installations ONLY. Additive, no table/data replacement.
BEGIN;
CREATE FUNCTION public.cn_probe_take_slot_v2(p_run_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$ SELECT jsonb_build_object('taken',public.cn_probe_take_slot(p_run_id)); $$;
REVOKE ALL ON FUNCTION public.cn_probe_take_slot_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cn_probe_take_slot_v2(uuid) TO service_role;
COMMIT;
