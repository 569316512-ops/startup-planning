BEGIN;
SELECT pg_advisory_xact_lock(19002501);
DO $migration$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cn_migrations WHERE version=1) THEN RAISE EXCEPTION 'Apply core first'; END IF;
 IF EXISTS(SELECT 1 FROM public.cn_migrations WHERE version=2 AND name<>'accounts-v1') THEN RAISE EXCEPTION 'Migration collision'; END IF;
 IF EXISTS(SELECT 1 FROM public.cn_migrations WHERE version=2) THEN RETURN; END IF;

 CREATE FUNCTION public.cn_auth_limit(p_source_hash text,p_account_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE start_at timestamptz:=date_trunc('hour',now()); source_hits integer;account_hits integer;
 BEGIN
  INSERT INTO cn_rate_limits(key_hash,window_start,hits,expires_at) VALUES(p_source_hash,start_at,1,start_at+interval '1 hour')
   ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=cn_rate_limits.hits+1 RETURNING hits INTO source_hits;
  INSERT INTO cn_rate_limits(key_hash,window_start,hits,expires_at) VALUES(p_account_hash,start_at,1,start_at+interval '1 hour')
   ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=cn_rate_limits.hits+1 RETURNING hits INTO account_hits;
  IF source_hits>60 OR account_hits>10 THEN RETURN jsonb_build_object('error','RATE_LIMITED'); END IF;
  RETURN jsonb_build_object('allowed',true);
 END $fn$;
 CREATE FUNCTION public.cn_auth_register(p_email text,p_hash text,p_salt text,p_token_hash text,p_expires timestamptz,p_admin boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;
 BEGIN
  INSERT INTO cn_users(email,password_hash,password_salt,role) VALUES(p_email,p_hash,p_salt,CASE WHEN p_admin THEN 'admin' ELSE 'user' END) ON CONFLICT(email) DO NOTHING RETURNING * INTO u;
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','EMAIL_EXISTS'); END IF;
  INSERT INTO cn_sessions(token_hash,user_id,expires_at) VALUES(p_token_hash,u.id,p_expires);
  RETURN to_jsonb(u)-'password_hash'-'password_salt'-'password_iterations';
 END $fn$;
 CREATE FUNCTION public.cn_auth_user(p_email text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
  SELECT coalesce((SELECT to_jsonb(u) FROM cn_users u WHERE email=p_email),'{}'::jsonb);
 $fn$;
 CREATE FUNCTION public.cn_auth_resolve(p_token_hash text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
  SELECT coalesce((SELECT jsonb_build_object('userId',u.id,'role',u.role) FROM cn_sessions s JOIN cn_users u ON u.id=s.user_id WHERE s.token_hash=p_token_hash AND s.expires_at>now() AND NOT u.disabled),'{}'::jsonb);
 $fn$;
 CREATE FUNCTION public.cn_auth_session_create(p_user_id uuid,p_expected_hash text,p_token_hash text,p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id FOR UPDATE;
  IF u.id IS NULL OR u.disabled OR u.password_hash<>p_expected_hash THEN RETURN '{}'::jsonb; END IF;
  INSERT INTO cn_sessions(token_hash,user_id,expires_at) VALUES(p_token_hash,u.id,p_expires);
  RETURN to_jsonb(u)-'password_hash'-'password_salt'-'password_iterations';
 END $fn$;
 CREATE FUNCTION public.cn_auth_logout(p_token_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN DELETE FROM cn_sessions WHERE token_hash=p_token_hash;RETURN jsonb_build_object('loggedOut',true); END $fn$;
 CREATE FUNCTION public.cn_auth_change_password(p_user_id uuid,p_expected_hash text,p_hash text,p_salt text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id FOR UPDATE;
  IF u.id IS NULL OR u.disabled OR u.password_hash<>p_expected_hash THEN RETURN jsonb_build_object('changed',false); END IF;
  UPDATE cn_users SET password_hash=p_hash,password_salt=p_salt,password_iterations=100000,updated_at=now() WHERE id=p_user_id;
  DELETE FROM cn_sessions WHERE user_id=p_user_id;
  RETURN jsonb_build_object('changed',true);
 END $fn$;
 CREATE FUNCTION public.cn_profile_get(p_user_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
  SELECT coalesce((SELECT to_jsonb(u)-'password_hash'-'password_salt'-'password_iterations' FROM cn_users u WHERE id=p_user_id AND NOT disabled),'{}'::jsonb);
 $fn$;
 CREATE FUNCTION public.cn_profile_update(p_user_id uuid,p_patch jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;patch jsonb;avatar uuid; merged jsonb;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  -- Defence in depth: server-only RPC still rejects unknown profile keys.
  IF jsonb_typeof(p_patch)<>'object' OR (p_patch-ARRAY['nickname','occupation','gender','city','district','budget','moveIn','leaseMonths','bio','roommateExpectations','housingPreferences','contact','avatarUploadId'])<>'{}'::jsonb THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  avatar:=CASE WHEN p_patch?'avatarUploadId' THEN (p_patch->>'avatarUploadId')::uuid ELSE u.avatar_upload_id END;
  IF avatar IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cn_uploads WHERE id=avatar AND owner_id=p_user_id AND state IN('ready','bound')) THEN RETURN jsonb_build_object('error','INVALID_UPLOAD'); END IF;
  patch:=p_patch-'avatarUploadId';merged:=u.profile||patch;
  IF patch?'contact' THEN merged:=jsonb_set(merged,'{contact}',coalesce(u.profile->'contact','{}'::jsonb)||(patch->'contact')); END IF;
  UPDATE cn_users SET profile=merged,avatar_upload_id=avatar,updated_at=now() WHERE id=p_user_id RETURNING * INTO u;
  RETURN to_jsonb(u)-'password_hash'-'password_salt'-'password_iterations';
 END $fn$;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('cn_auth_limit','cn_auth_register','cn_auth_user','cn_auth_resolve','cn_auth_session_create','cn_auth_logout','cn_auth_change_password','cn_profile_get','cn_profile_update') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
 INSERT INTO cn_migrations(version,name) VALUES(2,'accounts-v1');
END $migration$;
COMMIT;
