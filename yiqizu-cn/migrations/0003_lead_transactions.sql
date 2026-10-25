BEGIN;
SELECT pg_advisory_xact_lock(19002501);
DO $migration$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cn_migrations WHERE version=2) THEN RAISE EXCEPTION 'Apply accounts first'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=3 AND name<>'leads-v1') THEN RAISE EXCEPTION 'Migration collision'; END IF;
 IF EXISTS(SELECT 1 FROM cn_migrations WHERE version=3) THEN RETURN; END IF;

 CREATE FUNCTION public.cn_public_lead(p cn_leads) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('id',p.id,'kind',p.kind,'city',p.city,'district',p.district,'budget',p.budget,'minLeaseMonths',p.min_lease_months,'preferredGender',p.preferred_gender,'housing',p.housing,'photoIds',to_jsonb(p.photo_ids),'avatarUploadId',p.avatar_upload_id,'source',p.source,'version',p.version,'createdAt',p.created_at,'updatedAt',p.updated_at,
 'title',p.data->>'title','moveIn',p.data->>'moveIn','gender',p.data->>'gender','nickname',p.data->>'nickname','occupation',p.data->>'occupation','note',p.data->>'note','coRentalRules',p.data->>'coRentalRules','roommateExpectations',p.data->>'roommateExpectations',
 'contactAvailable',p.contact_visibility='members',
 'publisher',(SELECT jsonb_build_object('nickname',p.data->>'nickname','occupation',p.data->>'occupation','bio',coalesce(u.profile->>'bio',''),'avatarUploadId',p.avatar_upload_id) FROM cn_users u WHERE id=p.owner_id));
 $fn$;
 CREATE FUNCTION public.cn_lead_photo_check(p_user_id uuid,p_id uuid,p_photos uuid[],p_avatar uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE n integer;
 BEGIN
  PERFORM id FROM cn_uploads WHERE id=ANY(p_photos) OR id=p_avatar ORDER BY id FOR UPDATE;
  SELECT count(*) INTO n FROM cn_uploads WHERE id=ANY(p_photos) AND owner_id=p_user_id AND (state='ready' AND lead_id IS NULL OR state='bound' AND lead_id=p_id);
  IF n<>cardinality(p_photos) THEN RETURN false; END IF;
  IF p_avatar IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cn_uploads WHERE id=p_avatar AND owner_id=p_user_id AND state IN('ready','bound')) THEN RETURN false; END IF;
  RETURN true;
 END $fn$;
 CREATE FUNCTION public.cn_create_lead(p_user_id uuid,p_input jsonb,p_request_id uuid,p_payload_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;e cn_publish_events;new_id uuid:=gen_random_uuid();photos uuid[];avatar uuid;today date:=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT * INTO e FROM cn_publish_events WHERE user_id=p_user_id AND request_id=p_request_id;
  IF e.user_id IS NOT NULL THEN
   IF e.payload_hash<>p_payload_hash THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
   RETURN jsonb_build_object('id',e.lead_id,'version',1);
  END IF;
  IF (SELECT count(*) FROM cn_publish_events WHERE user_id=p_user_id AND day=today)>=3 THEN RETURN jsonb_build_object('error','QUOTA_EXCEEDED'); END IF;
  SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO photos FROM jsonb_array_elements_text(p_input->'photoIds');avatar:=(p_input->>'avatarUploadId')::uuid;
  IF NOT cn_lead_photo_check(p_user_id,new_id,photos,avatar) THEN RETURN jsonb_build_object('error','INVALID_UPLOAD'); END IF;
  INSERT INTO cn_leads(id,owner_id,kind,city,district,budget,min_lease_months,preferred_gender,data,housing,photo_ids,avatar_upload_id,contact_type,contact_value,contact_visibility,source)
  VALUES(new_id,p_user_id,p_input->>'kind',p_input->>'city',p_input->>'district',(p_input->>'budget')::integer,(p_input->>'minLeaseMonths')::integer,p_input->>'preferredGender',
   p_input-ARRAY['kind','city','district','budget','minLeaseMonths','preferredGender','housing','photoIds','avatarUploadId','contactType','contact','contactVisibility','source','adult','consent','publicConsent'],
   nullif(p_input->'housing','null'::jsonb),photos,avatar,p_input->>'contactType',p_input->>'contact',p_input->>'contactVisibility',p_input->>'source');
  UPDATE cn_uploads SET state='bound',lead_id=new_id WHERE id=ANY(photos);
  INSERT INTO cn_publish_events(user_id,day,request_id,payload_hash,lead_id) VALUES(p_user_id,today,p_request_id,p_payload_hash,new_id);
  RETURN jsonb_build_object('id',new_id,'version',1);
 END $fn$;
 CREATE FUNCTION public.cn_update_lead(p_user_id uuid,p_id uuid,p_input jsonb,p_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE l cn_leads;photos uuid[];avatar uuid;
 BEGIN
  PERFORM id FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT * INTO l FROM cn_leads WHERE id=p_id FOR UPDATE;
  IF l.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  IF l.owner_id<>p_user_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  IF l.version<>p_version OR l.kind<>p_input->>'kind' OR l.visibility='withdrawn' THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
  IF l.created_at<((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai' THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO photos FROM jsonb_array_elements_text(p_input->'photoIds');avatar:=(p_input->>'avatarUploadId')::uuid;
  IF NOT cn_lead_photo_check(p_user_id,p_id,photos,avatar) THEN RETURN jsonb_build_object('error','INVALID_UPLOAD'); END IF;
  UPDATE cn_leads SET city=p_input->>'city',district=p_input->>'district',budget=(p_input->>'budget')::integer,min_lease_months=(p_input->>'minLeaseMonths')::integer,preferred_gender=p_input->>'preferredGender',
   data=p_input-ARRAY['kind','city','district','budget','minLeaseMonths','preferredGender','housing','photoIds','avatarUploadId','contactType','contact','contactVisibility','source','adult','consent','publicConsent'],
   housing=nullif(p_input->'housing','null'::jsonb),photo_ids=photos,avatar_upload_id=avatar,contact_type=p_input->>'contactType',contact_value=p_input->>'contact',contact_visibility=p_input->>'contactVisibility',version=version+1,updated_at=now()
   WHERE id=p_id;
  UPDATE cn_uploads SET state='ready',lead_id=NULL WHERE lead_id=p_id AND NOT id=ANY(photos);
  UPDATE cn_uploads SET state='bound',lead_id=p_id WHERE id=ANY(photos);
  RETURN jsonb_build_object('id',p_id,'version',p_version+1);
 END $fn$;
 CREATE FUNCTION public.cn_withdraw_lead(p_user_id uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  UPDATE cn_leads SET visibility='withdrawn',version=version+1,updated_at=now() WHERE id=p_id AND owner_id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  RETURN jsonb_build_object('withdrawn',true);
 END $fn$;
 CREATE FUNCTION public.cn_get_lead(p_id uuid,p_user_id uuid,p_owned boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE l cn_leads;
 BEGIN
  SELECT * INTO l FROM cn_leads WHERE id=p_id AND created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai';
  IF l.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  IF p_owned THEN
   IF p_user_id IS NULL OR l.owner_id<>p_user_id OR NOT EXISTS(SELECT 1 FROM cn_users WHERE id=p_user_id AND NOT disabled) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
   RETURN cn_public_lead(l)||jsonb_build_object('ownerId',l.owner_id,'contact',l.contact_value,'contactType',l.contact_type,'contactVisibility',l.contact_visibility,'visibility',l.visibility,'followupStatus',l.followup_status);
  END IF;
  IF l.visibility<>'active' OR l.source='test' OR NOT EXISTS(SELECT 1 FROM cn_users WHERE id=l.owner_id AND NOT disabled) THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  RETURN cn_public_lead(l);
 END $fn$;
 CREATE FUNCTION public.cn_list_leads(p_user_id uuid,p_mine boolean,p_filter jsonb,p_cursor_time timestamptz,p_cursor_id uuid,p_limit integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(cn_public_lead(x) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb)) FROM (
   SELECT l.* FROM cn_leads l JOIN cn_users u ON u.id=l.owner_id AND NOT u.disabled
   WHERE l.created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai'
    AND CASE WHEN p_mine THEN p_user_id IS NOT NULL AND l.owner_id=p_user_id ELSE l.visibility='active' AND l.source<>'test' END
    AND (NOT p_filter?'city' OR l.city=p_filter->>'city') AND (NOT p_filter?'district' OR l.district=p_filter->>'district')
    AND (NOT p_filter?'kind' OR l.kind=p_filter->>'kind') AND (NOT p_filter?'minPrice' OR l.budget>=(p_filter->>'minPrice')::integer)
    AND (NOT p_filter?'maxPrice' OR l.budget<=(p_filter->>'maxPrice')::integer)
    AND (NOT p_filter?'bedrooms' OR l.housing->>'bedrooms'=p_filter->>'bedrooms')
    AND (NOT (p_filter?'amenities') OR (l.housing->'amenities') @> (p_filter->'amenities'))
    AND (p_cursor_time IS NULL OR (l.created_at,l.id)<(p_cursor_time,p_cursor_id))
   ORDER BY l.created_at DESC,l.id DESC LIMIT least(greatest(p_limit,1),25)
  ) x;
 $fn$;
 CREATE FUNCTION public.cn_get_contact(p_user_id uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 DECLARE u cn_users;l cn_leads;contact_key text;n integer;today date:=(now() AT TIME ZONE 'Asia/Shanghai')::date;
 BEGIN
  SELECT * INTO u FROM cn_users WHERE id=p_user_id AND NOT disabled FOR UPDATE;
  IF u.id IS NULL THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  SELECT * INTO l FROM cn_leads WHERE id=p_id AND visibility='active' AND source<>'test' AND created_at>=((now() AT TIME ZONE 'Asia/Shanghai')-interval '6 months') AT TIME ZONE 'Asia/Shanghai' FOR SHARE;
  IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM cn_users WHERE id=l.owner_id AND NOT disabled) THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  IF l.contact_visibility<>'members' AND u.role<>'admin' AND l.owner_id<>u.id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
  contact_key:=encode(sha256(convert_to(l.contact_type||':'||l.contact_value,'UTF8')),'hex');
  SELECT count(*) INTO n FROM cn_contact_views WHERE user_id=p_user_id AND day=today;
  IF u.role<>'admin' AND l.owner_id<>u.id THEN
   IF NOT EXISTS(SELECT 1 FROM cn_contact_views WHERE user_id=p_user_id AND day=today AND contact_hash=contact_key) THEN
    IF n>=5 THEN RETURN jsonb_build_object('error','QUOTA_EXCEEDED'); END IF;
    INSERT INTO cn_contact_views(user_id,day,contact_hash) VALUES(p_user_id,today,contact_key);n:=n+1;
   END IF;
  END IF;
  RETURN jsonb_build_object('type',l.contact_type,'value',l.contact_value,'remaining',greatest(5-n,0));
 END $fn$;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('cn_public_lead','cn_lead_photo_check','cn_create_lead','cn_update_lead','cn_withdraw_lead','cn_get_lead','cn_list_leads','cn_get_contact') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
 INSERT INTO cn_migrations(version,name) VALUES(3,'leads-v1');
END $migration$;
COMMIT;
