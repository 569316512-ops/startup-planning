BEGIN;
SELECT pg_advisory_xact_lock(19002501);
DO $migration$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cn_migrations WHERE version=3) THEN RAISE EXCEPTION 'Apply leads first'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=4 AND name<>'uploads-v1') THEN RAISE EXCEPTION 'Migration collision'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=4) THEN RETURN; END IF;
 CREATE FUNCTION public.cn_upload_begin(p_user_id uuid,p_id uuid,p_key text,p_type text,p_size integer) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  PERFORM id FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  IF (SELECT count(*) FROM cn_uploads WHERE owner_id=p_user_id AND created_at>now()-interval '24 hours')>=48 THEN RETURN jsonb_build_object('error','QUOTA_EXCEEDED'); END IF;
  INSERT INTO cn_uploads(id,owner_id,object_key,mime_type,size_bytes) VALUES(p_id,p_user_id,p_key,p_type,p_size);
  RETURN jsonb_build_object('created',true);
 END $fn$;
 CREATE FUNCTION public.cn_upload_get(p_user_id uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_uploads;
 BEGIN
  SELECT * INTO u FROM cn_uploads WHERE id=p_id AND owner_id=p_user_id AND state<>'deleting' AND EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND NOT disabled);
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;RETURN to_jsonb(u);
 END $fn$;
 CREATE FUNCTION public.cn_upload_ready(p_user_id uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  UPDATE cn_uploads SET state='ready',finalized_at=now() WHERE id=p_id AND owner_id=p_user_id AND state='pending' AND EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND NOT disabled);
  IF NOT FOUND THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;RETURN jsonb_build_object('ready',true);
 END $fn$;
 CREATE FUNCTION public.cn_upload_reads(p_user_id uuid,p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE result jsonb;n integer;
 BEGIN
  IF cardinality(p_ids)>24 THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT jsonb_agg(to_jsonb(u)),count(*) INTO result,n FROM cn_uploads u
   WHERE u.id=ANY(p_ids) AND u.state IN('ready','bound') AND (
    u.owner_id=p_user_id AND EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND NOT disabled)
    OR EXISTS(SELECT 1 FROM cn_leads l JOIN cn_users owner ON owner.id=l.owner_id AND NOT owner.disabled WHERE (u.id=ANY(l.photo_ids) OR u.id=l.avatar_upload_id) AND l.visibility='active' AND l.source<>'test' AND l.created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai')
   );
  IF n<>cardinality(p_ids) THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  RETURN jsonb_build_object('items',coalesce(result,'[]'::jsonb));
 END $fn$;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('cn_upload_begin','cn_upload_get','cn_upload_ready','cn_upload_reads') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
 INSERT INTO cn_migrations(version,name) VALUES(4,'uploads-v1');
END $migration$;
COMMIT;
