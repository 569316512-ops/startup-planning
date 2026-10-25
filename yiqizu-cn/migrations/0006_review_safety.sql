BEGIN;
SELECT pg_advisory_xact_lock(19002501);
DO $migration$ BEGIN
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=6 AND name<>'review-safety-v1') THEN RAISE EXCEPTION 'Migration collision'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=6) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM cn_migrations WHERE version=5) THEN RAISE EXCEPTION 'Apply operations first'; END IF;
 CREATE OR REPLACE FUNCTION public.cn_profile_update(p_user_id uuid,p_patch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;patch jsonb;avatar uuid; merged jsonb;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  -- Defence in depth: server-only RPC still rejects unknown profile keys.
  IF jsonb_typeof(p_patch)<>'object' OR (p_patch-ARRAY['nickname','occupation','gender','city','district','budget','moveIn','leaseMonths','bio','roommateExpectations','housingPreferences','contact','avatarUploadId'])<>'{}'::jsonb THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  avatar:=CASE WHEN p_patch?'avatarUploadId' THEN (p_patch->>'avatarUploadId')::uuid ELSE u.avatar_upload_id END;
  PERFORM id FROM cn_uploads WHERE id=avatar FOR UPDATE;
  IF avatar IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cn_uploads WHERE id=avatar AND owner_id=p_user_id AND state IN('ready','bound')) THEN RETURN jsonb_build_object('error','INVALID_UPLOAD'); END IF;
  patch:=p_patch-'avatarUploadId';merged:=u.profile||patch;
  IF patch?'contact' THEN merged:=jsonb_set(merged,'{contact}',coalesce(u.profile->'contact','{}'::jsonb)||(patch->'contact')); END IF;
  UPDATE cn_users SET profile=merged,avatar_upload_id=avatar,updated_at=now() WHERE id=p_user_id RETURNING * INTO u;
  RETURN to_jsonb(u)-'password_hash'-'password_salt'-'password_iterations';
 END $fn$;
 CREATE OR REPLACE FUNCTION public.cn_operations_update(p_user_id uuid,p_id uuid,p_followup text,p_visibility text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND role='admin' AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  IF p_visibility IS NOT NULL AND EXISTS(SELECT 1 FROM cn_leads WHERE id=p_id AND visibility='withdrawn') THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
  PERFORM id FROM cn_leads WHERE id=p_id FOR UPDATE;
  IF p_visibility IS NOT NULL AND EXISTS(SELECT 1 FROM cn_leads WHERE id=p_id AND visibility='withdrawn') THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
  UPDATE cn_leads SET followup_status=coalesce(p_followup,followup_status),visibility=coalesce(p_visibility,visibility),version=version+1,updated_at=now() WHERE id=p_id AND created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai';
  IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;RETURN jsonb_build_object('updated',true);
 END $fn$;
 CREATE OR REPLACE FUNCTION public.cn_cleanup_prepare(p_now timestamptz,p_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE cutoff timestamptz:=((p_now AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai';n integer;items jsonb;candidate uuid;
 BEGIN
  -- Public/ops queries exclude expiry immediately; physical deletion is operator-triggered.
  UPDATE cn_uploads SET lead_id=NULL,state=CASE WHEN state='bound' THEN 'ready' ELSE state END WHERE lead_id IN(SELECT id FROM cn_leads WHERE created_at<cutoff);
  DELETE FROM cn_leads WHERE created_at<cutoff;GET DIAGNOSTICS n=ROW_COUNT;
  FOR candidate IN SELECT u.id FROM cn_uploads u WHERE created_at<p_now-interval '24 hours' AND state IN('pending','ready','bound') AND NOT EXISTS(SELECT 1 FROM cn_users WHERE avatar_upload_id=u.id) AND NOT EXISTS(SELECT 1 FROM cn_leads WHERE u.id=ANY(photo_ids) OR avatar_upload_id=u.id) ORDER BY u.id LIMIT 25 FOR UPDATE LOOP
   UPDATE cn_uploads u SET state='deleting' WHERE id=candidate
    AND NOT EXISTS(SELECT 1 FROM cn_users WHERE avatar_upload_id=u.id)
    AND NOT EXISTS(SELECT 1 FROM cn_leads WHERE u.id=ANY(photo_ids) OR avatar_upload_id=u.id);
  END LOOP;
  SELECT jsonb_agg(jsonb_build_object('id',id,'object_key',object_key)) INTO items FROM (SELECT id,object_key FROM cn_uploads WHERE state='deleting' ORDER BY created_at,id LIMIT least(greatest(p_limit,1),25)) x;
  DELETE FROM cn_events WHERE created_at<p_now-interval '30 days';
  DELETE FROM cn_contact_views WHERE day<(p_now AT TIME ZONE 'Asia/Shanghai')::date-30;
  DELETE FROM cn_publish_events WHERE day<(p_now AT TIME ZONE 'Asia/Shanghai')::date-30;
  DELETE FROM cn_rate_limits WHERE expires_at<p_now;
  DELETE FROM cn_sessions WHERE expires_at<p_now;
  RETURN jsonb_build_object('hidden',n,'items',coalesce(items,'[]'::jsonb));
 END $fn$;
 INSERT INTO cn_migrations(version,name) VALUES(6,'review-safety-v1');
END $migration$;
COMMIT;
