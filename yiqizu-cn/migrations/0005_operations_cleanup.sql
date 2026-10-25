BEGIN;
SELECT pg_advisory_xact_lock(19002501);
DO $migration$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cn_migrations WHERE version=4) THEN RAISE EXCEPTION 'Apply uploads first'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=5 AND name<>'operations-v1') THEN RAISE EXCEPTION 'Migration collision'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=5) THEN RETURN; END IF;
 CREATE FUNCTION public.cn_operations_list(p_user_id uuid,p_cursor_time timestamptz,p_cursor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE result jsonb;
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT jsonb_agg(cn_public_lead(l)||jsonb_build_object('ownerId',l.owner_id,'contact',l.contact_value,'contactType',l.contact_type,'contactVisibility',l.contact_visibility,'visibility',l.visibility,'followupStatus',l.followup_status) ORDER BY l.created_at DESC,l.id DESC) INTO result FROM (
   SELECT * FROM cn_leads WHERE created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai' AND (p_cursor_time IS NULL OR (created_at,id)<(p_cursor_time,p_cursor_id)) ORDER BY created_at DESC,id DESC LIMIT 201
  ) l;
  RETURN jsonb_build_object('items',coalesce(result,'[]'::jsonb));
 END $fn$;
 CREATE FUNCTION public.cn_operations_update(p_user_id uuid,p_id uuid,p_followup text,p_visibility text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  UPDATE cn_leads SET followup_status=coalesce(p_followup,followup_status),visibility=coalesce(p_visibility,visibility),version=version+1,updated_at=now() WHERE id=p_id AND created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai';
  IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;RETURN jsonb_build_object('updated',true);
 END $fn$;
 CREATE FUNCTION public.cn_feedback_submit(p_category text,p_content text,p_contact text,p_post_id uuid,p_source_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE hits integer;id uuid;start_at timestamptz:=date_trunc('hour',now());
 BEGIN
  INSERT INTO cn_rate_limits(key_hash,window_start,hits,expires_at) VALUES(p_source_hash,start_at,1,start_at+interval '1 hour') ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=cn_rate_limits.hits+1 RETURNING cn_rate_limits.hits INTO hits;
  IF hits>5 THEN RETURN jsonb_build_object('error','RATE_LIMITED'); END IF;
  INSERT INTO cn_feedback(category,content,contact,post_id) VALUES(p_category,p_content,p_contact,p_post_id) RETURNING cn_feedback.id INTO id;
  RETURN jsonb_build_object('id',id);
 END $fn$;
 CREATE FUNCTION public.cn_feedback_list(p_user_id uuid,p_cursor_time timestamptz,p_cursor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE result jsonb;
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at DESC,f.id DESC) INTO result FROM (SELECT * FROM cn_feedback WHERE p_cursor_time IS NULL OR (created_at,id)<(p_cursor_time,p_cursor_id) ORDER BY created_at DESC,id DESC LIMIT 201) f;
  RETURN jsonb_build_object('items',coalesce(result,'[]'::jsonb));
 END $fn$;
 CREATE FUNCTION public.cn_feedback_resolve(p_user_id uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  UPDATE cn_feedback SET status='resolved' WHERE id=p_id;RETURN jsonb_build_object('resolved',FOUND);
 END $fn$;
 CREATE FUNCTION public.cn_record_event(p_event text,p_event_id uuid,p_session_id uuid,p_city text,p_source text,p_source_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE hits integer;start_at timestamptz:=date_trunc('minute',now());
 BEGIN
  IF EXISTS(SELECT 1 FROM cn_events WHERE event_id=p_event_id) THEN RETURN jsonb_build_object('recorded',true); END IF;
  INSERT INTO cn_rate_limits(key_hash,window_start,hits,expires_at) VALUES(p_source_hash,start_at,1,start_at+interval '1 minute') ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=cn_rate_limits.hits+1 RETURNING cn_rate_limits.hits INTO hits;
  IF hits>120 THEN RETURN jsonb_build_object('error','RATE_LIMITED'); END IF;
  INSERT INTO cn_events(event_id,session_id,event,city,source) VALUES(p_event_id,p_session_id,p_event,p_city,p_source) ON CONFLICT(event_id) DO NOTHING;
  RETURN jsonb_build_object('recorded',true);
 END $fn$;
 CREATE FUNCTION public.cn_metrics(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE events jsonb;registrations jsonb;
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT jsonb_agg(to_jsonb(x)) INTO events FROM (SELECT event,count(DISTINCT session_id) AS sessions FROM cn_events WHERE created_at>=now()-interval '7 days' AND source<>'test' GROUP BY event) x;
  SELECT jsonb_agg(to_jsonb(x)) INTO registrations FROM (SELECT source,followup_status AS status,count(*) AS count FROM cn_leads WHERE created_at>=now()-interval '7 days' AND source<>'test' GROUP BY source,followup_status) x;
  RETURN jsonb_build_object('events',coalesce(events,'[]'::jsonb),'registrations',coalesce(registrations,'[]'::jsonb));
 END $fn$;
 CREATE FUNCTION public.cn_cleanup_prepare(p_now timestamptz,p_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE cutoff timestamptz:=((p_now AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai';n integer;items jsonb;
 BEGIN
  -- Public/ops queries exclude expiry immediately; physical deletion is operator-triggered.
  UPDATE cn_uploads SET lead_id=NULL,state=CASE WHEN state='bound' THEN 'ready' ELSE state END WHERE lead_id IN(SELECT id FROM cn_leads WHERE created_at<cutoff);
  DELETE FROM cn_leads WHERE created_at<cutoff;GET DIAGNOSTICS n=ROW_COUNT;
  UPDATE cn_uploads u SET state='deleting' WHERE created_at<p_now-interval '24 hours' AND state IN('pending','ready','bound')
   AND NOT EXISTS(SELECT 1 FROM cn_users WHERE avatar_upload_id=u.id)
   AND NOT EXISTS(SELECT 1 FROM cn_leads WHERE u.id=ANY(photo_ids) OR avatar_upload_id=u.id);
  SELECT jsonb_agg(jsonb_build_object('id',id,'object_key',object_key)) INTO items FROM (SELECT id,object_key FROM cn_uploads WHERE state='deleting' ORDER BY created_at,id LIMIT least(greatest(p_limit,1),25)) x;
  DELETE FROM cn_events WHERE created_at<p_now-interval '30 days';
  DELETE FROM cn_contact_views WHERE day<(p_now AT TIME ZONE 'Asia/Shanghai')::date-30;
  DELETE FROM cn_publish_events WHERE day<(p_now AT TIME ZONE 'Asia/Shanghai')::date-30;
  DELETE FROM cn_rate_limits WHERE expires_at<p_now;
  DELETE FROM cn_sessions WHERE expires_at<p_now;
  RETURN jsonb_build_object('hidden',n,'items',coalesce(items,'[]'::jsonb));
 END $fn$;
 CREATE FUNCTION public.cn_cleanup_done(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  DELETE FROM cn_uploads WHERE id=p_id AND state='deleting';RETURN jsonb_build_object('deleted',FOUND);
 END $fn$;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('cn_operations_list','cn_operations_update','cn_feedback_submit','cn_feedback_list','cn_feedback_resolve','cn_record_event','cn_metrics','cn_cleanup_prepare','cn_cleanup_done') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
 INSERT INTO cn_migrations(version,name) VALUES(5,'operations-v1');
END $migration$;
COMMIT;
