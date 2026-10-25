-- Additive domestic MVP schema. No legacy/Sites/system tables are modified.
BEGIN;
SELECT pg_advisory_xact_lock(19002501);
CREATE TABLE IF NOT EXISTS public.cn_migrations(version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cn_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cn_migrations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.cn_migrations FROM PUBLIC,anon,authenticated;
DO $migration$
DECLARE t text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.cn_migrations WHERE version=1 AND name<>'core-v1') THEN RAISE EXCEPTION 'Migration version collision'; END IF;
 IF EXISTS(SELECT 1 FROM public.cn_migrations WHERE version=1) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN RAISE EXCEPTION 'Server-only role unavailable'; END IF;

 CREATE TABLE public.cn_users(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK(email=lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  password_hash text NOT NULL CHECK(password_hash~'^[0-9a-f]{64}$'),
  password_salt text NOT NULL CHECK(password_salt~'^[0-9a-f]{32}$'),
  password_iterations integer NOT NULL DEFAULT 100000 CHECK(password_iterations>=100000),
  role text NOT NULL DEFAULT 'user' CHECK(role IN('user','admin')),
  disabled boolean NOT NULL DEFAULT false,
  profile jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(profile)='object' AND NOT profile ?| ARRAY['password','passwordHash','token','isAdmin','role','email','id']),
  avatar_upload_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE TABLE public.cn_sessions(
  token_hash text PRIMARY KEY CHECK(token_hash~'^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES public.cn_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
 );
 CREATE INDEX cn_sessions_user ON public.cn_sessions(user_id);
 CREATE TABLE public.cn_leads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES public.cn_users(id),
  kind text NOT NULL CHECK(kind IN('room','seeker')),city text NOT NULL,district text NOT NULL,
  budget integer NOT NULL CHECK(budget BETWEEN 1 AND 50000),
  min_lease_months integer NOT NULL CHECK(min_lease_months BETWEEN 1 AND 60),
  preferred_gender text NOT NULL CHECK(preferred_gender IN('男','女','不限')),
  data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND NOT data ?| ARRAY['contact','contactType','contactVisibility','password','token','ownerId','email']),
  housing jsonb CHECK(housing IS NULL OR jsonb_typeof(housing)='object'),
  photo_ids uuid[] NOT NULL DEFAULT '{}',avatar_upload_id uuid,
  contact_type text NOT NULL CHECK(contact_type IN('wechat','phone')),
  contact_value text NOT NULL CHECK(char_length(contact_value) BETWEEN 1 AND 40),
  contact_visibility text NOT NULL CHECK(contact_visibility IN('operator','members')),
  source text NOT NULL CHECK(source IN('direct','xiaohongshu','douyin','wechat','friend','other','test')),
  visibility text NOT NULL DEFAULT 'active' CHECK(visibility IN('active','hidden','withdrawn')),
  followup_status text NOT NULL DEFAULT 'new' CHECK(followup_status IN('new','qualified','contacted','viewing','matched','invalid')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(cardinality(photo_ids)<=12),CHECK((kind='room' AND housing IS NOT NULL) OR (kind='seeker' AND housing IS NULL))
 );
 CREATE INDEX cn_leads_catalog ON public.cn_leads(city,visibility,created_at DESC,id DESC);
 CREATE INDEX cn_leads_owner ON public.cn_leads(owner_id,created_at DESC,id DESC);
 CREATE INDEX cn_leads_retention ON public.cn_leads(created_at);
 CREATE INDEX cn_leads_housing ON public.cn_leads USING gin(housing);
 CREATE TABLE public.cn_uploads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES public.cn_users(id),
  object_key text NOT NULL UNIQUE CHECK(object_key~'^cn-photos/[0-9a-f-]+/[0-9a-f-]+$'),
  mime_type text NOT NULL CHECK(mime_type IN('image/jpeg','image/png','image/webp')),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','ready','bound','deleting')),
  lead_id uuid REFERENCES public.cn_leads(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),finalized_at timestamptz,
  CHECK(state<>'bound' OR lead_id IS NOT NULL)
 );
 CREATE INDEX cn_uploads_owner ON public.cn_uploads(owner_id);
 CREATE INDEX cn_uploads_cleanup ON public.cn_uploads(state,created_at);
 ALTER TABLE public.cn_users ADD CONSTRAINT cn_users_avatar_fk FOREIGN KEY(avatar_upload_id) REFERENCES public.cn_uploads(id) ON DELETE RESTRICT;
 ALTER TABLE public.cn_leads ADD CONSTRAINT cn_leads_avatar_fk FOREIGN KEY(avatar_upload_id) REFERENCES public.cn_uploads(id) ON DELETE RESTRICT;
 CREATE TABLE public.cn_publish_events(
  user_id uuid NOT NULL REFERENCES public.cn_users(id),day date NOT NULL,request_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK(payload_hash~'^[0-9a-f]{64}$'),lead_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id)
 ); -- lead_id deliberately has no FK: withdrawal/retention cannot refund quota or erase idempotency.
 CREATE INDEX cn_publish_events_quota ON public.cn_publish_events(user_id,day);
 CREATE TABLE public.cn_contact_views(
  user_id uuid NOT NULL REFERENCES public.cn_users(id),day date NOT NULL,
  contact_hash text NOT NULL CHECK(contact_hash~'^[0-9a-f]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,day,contact_hash)
 );
 CREATE TABLE public.cn_events(
  event_id uuid PRIMARY KEY,session_id uuid NOT NULL,
  event text NOT NULL CHECK(event IN('visit','quick_open','detail_open','contact_click')),
  city text NOT NULL,source text NOT NULL CHECK(source IN('direct','xiaohongshu','douyin','wechat','friend','other','test')),
  created_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX cn_events_time ON public.cn_events(created_at);
 CREATE TABLE public.cn_feedback(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category text NOT NULL CHECK(category IN('bug','privacy','report')),
  content text NOT NULL CHECK(char_length(btrim(content)) BETWEEN 4 AND 2000),
  contact text NOT NULL CHECK(char_length(contact)<=100),post_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK(status IN('new','resolved')),created_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX cn_feedback_queue ON public.cn_feedback(status,created_at DESC,id DESC);
 CREATE TABLE public.cn_rate_limits(
  key_hash text NOT NULL CHECK(key_hash~'^[0-9a-f]{64}$'),window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK(hits>0),expires_at timestamptz NOT NULL,
  PRIMARY KEY(key_hash,window_start),CHECK(expires_at>window_start)
 );
 FOREACH t IN ARRAY ARRAY['cn_users','cn_sessions','cn_leads','cn_uploads','cn_publish_events','cn_contact_views','cn_events','cn_feedback','cn_rate_limits'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
 INSERT INTO public.cn_migrations(version,name) VALUES(1,'core-v1');
END $migration$;
COMMIT;
