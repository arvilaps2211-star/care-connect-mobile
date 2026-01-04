-- Fix RLS for public.emergencies to allow hospitals/ambulances/admins to manage emergencies

ALTER TABLE public.emergencies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Hospitals and ambulances can update emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Hospitals and ambulances can view all emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users can insert own emergencies" ON public.emergencies;
DROP POLICY IF EXISTS "Users can view own emergencies" ON public.emergencies;

-- SELECT: users can read their own; hospitals/ambulances/admins can read all
CREATE POLICY "Users can view own emergencies"
ON public.emergencies
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Hospitals/ambulances/admins can view all emergencies"
ON public.emergencies
FOR SELECT
USING (
  public.has_role(auth.uid(), 'hospital'::public.app_role)
  OR public.has_role(auth.uid(), 'ambulance'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- INSERT: users can create for themselves; hospitals/ambulances/admins can also create (e.g., testing or assisted entry)
CREATE POLICY "Users can insert own emergencies"
ON public.emergencies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hospitals/ambulances/admins can insert emergencies"
ON public.emergencies
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'hospital'::public.app_role)
  OR public.has_role(auth.uid(), 'ambulance'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- UPDATE: hospitals/ambulances/admins can update any emergency
CREATE POLICY "Hospitals/ambulances/admins can update emergencies"
ON public.emergencies
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'hospital'::public.app_role)
  OR public.has_role(auth.uid(), 'ambulance'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'hospital'::public.app_role)
  OR public.has_role(auth.uid(), 'ambulance'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
