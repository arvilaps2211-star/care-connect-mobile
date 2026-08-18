-- 1. Backfill a default 'user' role for every account that has none
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Self-healing bootstrap: any signed-in account without a role gets 'user'
CREATE OR REPLACE FUNCTION public.ensure_default_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT v_uid, 'user'::app_role
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = v_uid
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1 WHEN 'hospital' THEN 2 WHEN 'ambulance' THEN 3 ELSE 4 END
  LIMIT 1;

  RETURN v_role;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_role() TO authenticated;

-- 3. Harden SECURITY DEFINER functions flagged by the linter
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.register_ambulance_for_hospital(uuid, text, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ambulance_for_hospital(uuid, text, text, numeric, numeric, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;