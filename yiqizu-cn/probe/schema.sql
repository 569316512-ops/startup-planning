-- Run ONLY in yiqizu-mvp-test-d4fa3kk6dc43ea64, PostgreSQL SQL console.
-- A naming collision aborts the whole transaction; this does not replace existing objects.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
  RAISE EXCEPTION 'Expected server-only service_role with BYPASSRLS is unavailable. Stop and report; do not weaken grants.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') OR
    NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  RAISE EXCEPTION 'Expected platform roles unavailable. Stop and report.';
 END IF;
END $$;
CREATE TABLE public.cn_probe_slots (
 run_id uuid PRIMARY KEY,
 taken boolean NOT NULL DEFAULT true CHECK(taken),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cn_probe_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_probe_slots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cn_probe_slots FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON TABLE public.cn_probe_slots TO service_role;

CREATE FUNCTION public.cn_probe_take_slot(p_run_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE inserted uuid;
BEGIN
 INSERT INTO public.cn_probe_slots(run_id) VALUES(p_run_id)
 ON CONFLICT (run_id) DO NOTHING RETURNING run_id INTO inserted;
 RETURN inserted IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.cn_probe_take_slot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cn_probe_take_slot(uuid) TO service_role;

-- Object return avoids node-sdk 3.18.7 converting scalar false to {}.
CREATE FUNCTION public.cn_probe_take_slot_v2(p_run_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$ SELECT jsonb_build_object('taken',public.cn_probe_take_slot(p_run_id)); $$;
REVOKE ALL ON FUNCTION public.cn_probe_take_slot_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cn_probe_take_slot_v2(uuid) TO service_role;
COMMIT;
